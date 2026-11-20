import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "../../common/utils/slugify";
import { PaginationQueryDto, Paginated } from "../../common/dto/pagination-query.dto";
import { CreatePlaylistDto } from "./dto/create-playlist.dto";
import { UpdatePlaylistDto } from "./dto/update-playlist.dto";

const SONG_INCLUDE = {
  artist: { select: { id: true, name: true, slug: true } },
  album: { select: { id: true, title: true, slug: true, coverUrl: true } },
  genre: { select: { id: true, name: true, slug: true } },
} as const;

@Injectable()
export class PlaylistsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(query: PaginationQueryDto): Promise<Paginated<unknown>> {
    const where = { isPublic: true, deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.playlist.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { updatedAt: "desc" },
        include: { owner: { select: { id: true, username: true, avatarUrl: true } } },
      }),
      this.prisma.playlist.count({ where }),
    ]);
    return this.paginate(items, total, query);
  }

  async findMine(userId: string, query: PaginationQueryDto): Promise<Paginated<unknown>> {
    const where = { ownerId: userId, deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.playlist.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.playlist.count({ where }),
    ]);
    return this.paginate(items, total, query);
  }

  /** A private playlist is visible only to its owner; a public one to anyone. */
  async findOne(idOrSlug: string, requestUserId: string | undefined) {
    const playlist = await this.prisma.playlist.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
      include: {
        owner: { select: { id: true, username: true, avatarUrl: true } },
        items: {
          orderBy: { position: "asc" },
          include: { song: { include: SONG_INCLUDE } },
        },
      },
    });

    if (!playlist) throw new NotFoundException("Playlist not found");
    if (!playlist.isPublic && playlist.ownerId !== requestUserId) {
      throw new NotFoundException("Playlist not found");
    }
    return playlist;
  }

  async create(userId: string, dto: CreatePlaylistDto) {
    return this.prisma.playlist.create({
      data: {
        title: dto.title,
        slug: await this.uniqueSlug(dto.title),
        description: dto.description,
        coverUrl: dto.coverUrl,
        accentColor: dto.accentColor,
        isPublic: dto.isPublic ?? true,
        ownerId: userId,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdatePlaylistDto) {
    const playlist = await this.getOwnedOrThrow(id, userId);
    return this.prisma.playlist.update({
      where: { id: playlist.id },
      data: {
        ...dto,
        ...(dto.title ? { slug: await this.uniqueSlug(dto.title, playlist.id) } : {}),
      },
    });
  }

  async remove(id: string, userId: string) {
    const playlist = await this.getOwnedOrThrow(id, userId);
    await this.prisma.playlist.update({
      where: { id: playlist.id },
      data: { deletedAt: new Date() },
    });
  }

  async addSong(id: string, userId: string, songId: string) {
    const playlist = await this.getOwnedOrThrow(id, userId);

    const song = await this.prisma.song.findUnique({ where: { id: songId } });
    if (!song || song.deletedAt) throw new NotFoundException("Song not found");

    const last = await this.prisma.playlistSong.findFirst({
      where: { playlistId: playlist.id },
      orderBy: { position: "desc" },
    });

    try {
      return await this.prisma.playlistSong.create({
        data: {
          playlistId: playlist.id,
          songId,
          position: (last?.position ?? -1) + 1,
          addedById: userId,
        },
      });
    } catch {
      throw new BadRequestException("Song is already in this playlist");
    }
  }

  async removeSong(id: string, userId: string, songId: string) {
    const playlist = await this.getOwnedOrThrow(id, userId);
    await this.prisma.playlistSong.deleteMany({
      where: { playlistId: playlist.id, songId },
    });
  }

  /** Replaces the ordering wholesale — every existing song must appear
   *  exactly once in `songIds`, or the request is rejected as malformed. */
  async reorder(id: string, userId: string, songIds: string[]) {
    const playlist = await this.getOwnedOrThrow(id, userId);
    const current = await this.prisma.playlistSong.findMany({
      where: { playlistId: playlist.id },
    });

    const currentIds = new Set(current.map((c) => c.songId));
    const newIds = new Set(songIds);
    if (
      currentIds.size !== newIds.size ||
      [...currentIds].some((id) => !newIds.has(id))
    ) {
      throw new BadRequestException(
        "songIds must contain every song currently in the playlist, exactly once",
      );
    }

    await this.prisma.$transaction(
      songIds.map((songId, index) =>
        this.prisma.playlistSong.update({
          where: { playlistId_songId: { playlistId: playlist.id, songId } },
          data: { position: index },
        }),
      ),
    );
  }

  private async getOwnedOrThrow(id: string, userId: string) {
    const playlist = await this.prisma.playlist.findUnique({ where: { id } });
    if (!playlist || playlist.deletedAt) throw new NotFoundException("Playlist not found");
    if (playlist.ownerId !== userId) {
      throw new ForbiddenException("You do not own this playlist");
    }
    return playlist;
  }

  private async uniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let suffix = 1;

    while (
      await this.prisma.playlist.findFirst({
        where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      })
    ) {
      candidate = `${base}-${++suffix}`;
    }
    return candidate;
  }

  private paginate<T>(items: T[], total: number, query: PaginationQueryDto): Paginated<T> {
    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }
}
