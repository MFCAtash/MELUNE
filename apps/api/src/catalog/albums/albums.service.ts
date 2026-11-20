import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "../../common/utils/slugify";
import { Paginated } from "../../common/dto/pagination-query.dto";
import { CreateAlbumDto } from "./dto/create-album.dto";
import { UpdateAlbumDto } from "./dto/update-album.dto";
import { AlbumQueryDto } from "./dto/album-query.dto";
import { ArtistsService } from "../artists/artists.service";

@Injectable()
export class AlbumsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artists: ArtistsService,
  ) {}

  async findAll(query: AlbumQueryDto): Promise<Paginated<unknown>> {
    const where = {
      deletedAt: null,
      ...(query.artistId ? { artistId: query.artistId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.album.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { releaseDate: "desc" },
        include: { artist: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.album.count({ where }),
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
    const album = await this.prisma.album.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
      include: {
        artist: { select: { id: true, name: true, slug: true, imageUrl: true } },
        songs: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: {
            artist: { select: { id: true, name: true, slug: true, imageUrl: true } },
            genre: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!album) throw new NotFoundException("Album not found");
    return album;
  }

  /** Creates an album under the calling artist's own profile. */
  async createForUser(userId: string, dto: CreateAlbumDto) {
    const artist = await this.artists.findByUserId(userId);
    if (!artist) throw new NotFoundException("Artist profile not found");

    return this.createRecord(artist.id, dto);
  }

  /** Admin-only path — creates an album under any artist, chosen explicitly via `dto.artistId`. */
  async createByAdmin(dto: CreateAlbumDto) {
    if (!dto.artistId) {
      throw new BadRequestException("artistId is required when creating as an admin");
    }
    const artist = await this.prisma.artist.findUnique({ where: { id: dto.artistId } });
    if (!artist || artist.deletedAt) {
      throw new BadRequestException("artistId does not exist");
    }

    return this.createRecord(artist.id, dto);
  }

  private async createRecord(artistId: string, dto: CreateAlbumDto) {
    return this.prisma.album.create({
      data: {
        title: dto.title,
        slug: await this.uniqueSlug(dto.title),
        artistId,
        coverUrl: dto.coverUrl,
        releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : undefined,
      },
    });
  }

  async update(id: string, userId: string, isAdmin: boolean, dto: UpdateAlbumDto) {
    const album = await this.getOwnedOrThrow(id, userId, isAdmin);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { artistId: _ignored, ...safeDto } = dto;

    return this.prisma.album.update({
      where: { id: album.id },
      data: {
        ...safeDto,
        ...(safeDto.title ? { slug: await this.uniqueSlug(safeDto.title, album.id) } : {}),
        ...(safeDto.releaseDate ? { releaseDate: new Date(safeDto.releaseDate) } : {}),
      },
    });
  }

  async remove(id: string, userId: string, isAdmin: boolean) {
    const album = await this.getOwnedOrThrow(id, userId, isAdmin);
    await this.prisma.album.update({
      where: { id: album.id },
      data: { deletedAt: new Date() },
    });
  }

  /** Loads the album and enforces that the caller owns its artist profile (or is admin). */
  async getOwnedOrThrow(id: string, userId: string, isAdmin: boolean) {
    const album = await this.prisma.album.findUnique({
      where: { id },
      include: { artist: true },
    });
    if (!album || album.deletedAt) throw new NotFoundException("Album not found");

    this.artists.assertOwnership(album.artist.userId, userId, isAdmin);
    return album;
  }

  private async uniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let suffix = 1;

    while (
      await this.prisma.album.findFirst({
        where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      })
    ) {
      candidate = `${base}-${++suffix}`;
    }

    return candidate;
  }
}
