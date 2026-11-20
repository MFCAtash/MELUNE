import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "../../common/utils/slugify";
import { PaginationQueryDto, Paginated } from "../../common/dto/pagination-query.dto";
import { CreateArtistDto } from "./dto/create-artist.dto";
import { UpdateArtistDto } from "./dto/update-artist.dto";

@Injectable()
export class ArtistsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto): Promise<Paginated<unknown>> {
    const where = { deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.artist.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { name: "asc" },
      }),
      this.prisma.artist.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findOne(idOrSlug: string) {
    const artist = await this.prisma.artist.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
      include: {
        albums: { where: { deletedAt: null }, orderBy: { releaseDate: "desc" } },
        songs: {
          where: { deletedAt: null },
          orderBy: { playCount: "desc" },
          take: 10,
          include: {
            artist: { select: { id: true, name: true, slug: true, imageUrl: true } },
            album: { select: { id: true, title: true, slug: true, coverUrl: true } },
            genre: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!artist) throw new NotFoundException("Artist not found");
    return artist;
  }

  async findByUserId(userId: string) {
    return this.prisma.artist.findUnique({ where: { userId } });
  }

  /** Creates the caller's own artist profile — one per user. */
  async createForUser(userId: string, dto: CreateArtistDto) {
    const existing = await this.findByUserId(userId);
    if (existing) {
      throw new ConflictException("Artist profile already exists for this user");
    }

    return this.prisma.artist.create({
      data: {
        userId,
        name: dto.name,
        slug: await this.uniqueSlug(dto.name),
        bio: dto.bio,
        imageUrl: dto.imageUrl,
      },
    });
  }

  /** Admin-only path — creates a catalog-only artist profile with no
   *  linked user account (e.g. cataloging an artist who isn't a platform
   *  member yet). `userId` stays null, same as a user whose account was
   *  later unlinked (see Artist.userId's `onDelete: SetNull`). */
  async createByAdmin(dto: CreateArtistDto) {
    return this.prisma.artist.create({
      data: {
        name: dto.name,
        slug: await this.uniqueSlug(dto.name),
        bio: dto.bio,
        imageUrl: dto.imageUrl,
      },
    });
  }

  async updateOwn(userId: string, dto: UpdateArtistDto) {
    const artist = await this.findByUserId(userId);
    if (!artist) throw new NotFoundException("Artist profile not found");
    return this.update(artist.id, dto);
  }

  /** Admin-only path — bypasses ownership. */
  async update(id: string, dto: UpdateArtistDto) {
    const artist = await this.prisma.artist.findUnique({ where: { id } });
    if (!artist || artist.deletedAt) throw new NotFoundException("Artist not found");

    return this.prisma.artist.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.name ? { slug: await this.uniqueSlug(dto.name, id) } : {}),
      },
    });
  }

  async remove(id: string) {
    const artist = await this.prisma.artist.findUnique({ where: { id } });
    if (!artist || artist.deletedAt) throw new NotFoundException("Artist not found");
    await this.prisma.artist.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** Throws if the given user isn't an ADMIN and doesn't own this artist profile. */
  assertOwnership(artistUserId: string | null, requestUserId: string, isAdmin: boolean) {
    if (isAdmin) return;
    if (artistUserId !== requestUserId) {
      throw new ForbiddenException("You do not own this artist profile");
    }
  }

  private async uniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let suffix = 1;

    while (
      await this.prisma.artist.findFirst({
        where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      })
    ) {
      candidate = `${base}-${++suffix}`;
    }

    return candidate;
  }
}
