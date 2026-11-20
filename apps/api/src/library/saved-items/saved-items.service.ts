import { Injectable, NotFoundException } from "@nestjs/common";
import { LibraryItemType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PaginationQueryDto, Paginated } from "../../common/dto/pagination-query.dto";

type SavableType = "album" | "artist" | "playlist";

const TYPE_MAP: Record<SavableType, LibraryItemType> = {
  album: LibraryItemType.ALBUM,
  artist: LibraryItemType.ARTIST,
  playlist: LibraryItemType.PLAYLIST,
};

@Injectable()
export class SavedItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async save(userId: string, type: SavableType, itemId: string): Promise<void> {
    await this.assertExists(type, itemId);

    const data = {
      userId,
      itemType: TYPE_MAP[type],
      albumId: type === "album" ? itemId : undefined,
      artistId: type === "artist" ? itemId : undefined,
      playlistId: type === "playlist" ? itemId : undefined,
    };

    // upsert on the type-specific unique constraint keeps saving idempotent.
    if (type === "album") {
      await this.prisma.libraryItem.upsert({
        where: { userId_albumId: { userId, albumId: itemId } },
        create: data,
        update: {},
      });
    } else if (type === "artist") {
      await this.prisma.libraryItem.upsert({
        where: { userId_artistId: { userId, artistId: itemId } },
        create: data,
        update: {},
      });
    } else {
      await this.prisma.libraryItem.upsert({
        where: { userId_playlistId: { userId, playlistId: itemId } },
        create: data,
        update: {},
      });
    }
  }

  async unsave(userId: string, type: SavableType, itemId: string): Promise<void> {
    if (type === "album") {
      await this.prisma.libraryItem.deleteMany({ where: { userId, albumId: itemId } });
    } else if (type === "artist") {
      await this.prisma.libraryItem.deleteMany({ where: { userId, artistId: itemId } });
    } else {
      await this.prisma.libraryItem.deleteMany({ where: { userId, playlistId: itemId } });
    }
  }

  async findMine(
    userId: string,
    type: SavableType | undefined,
    query: PaginationQueryDto,
  ): Promise<Paginated<unknown>> {
    const where = { userId, ...(type ? { itemType: TYPE_MAP[type] } : {}) };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.libraryItem.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: "desc" },
        include: {
          album: { include: { artist: { select: { id: true, name: true, slug: true } } } },
          artist: true,
          playlist: { include: { owner: { select: { id: true, username: true } } } },
        },
      }),
      this.prisma.libraryItem.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  private async assertExists(type: SavableType, itemId: string) {
    if (type === "album") {
      const album = await this.prisma.album.findUnique({ where: { id: itemId } });
      if (!album || album.deletedAt) throw new NotFoundException("Album not found");
    } else if (type === "artist") {
      const artist = await this.prisma.artist.findUnique({ where: { id: itemId } });
      if (!artist || artist.deletedAt) throw new NotFoundException("Artist not found");
    } else {
      const playlist = await this.prisma.playlist.findUnique({ where: { id: itemId } });
      if (!playlist || playlist.deletedAt) throw new NotFoundException("Playlist not found");
    }
  }
}
