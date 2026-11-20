import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PaginationQueryDto, Paginated } from "../../common/dto/pagination-query.dto";

@Injectable()
export class LikesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent — liking an already-liked song is a no-op, not an error. */
  async like(userId: string, songId: string): Promise<void> {
    const song = await this.prisma.song.findUnique({ where: { id: songId } });
    if (!song || song.deletedAt) throw new NotFoundException("Song not found");

    await this.prisma.like.upsert({
      where: { userId_songId: { userId, songId } },
      create: { userId, songId },
      update: {},
    });
  }

  async unlike(userId: string, songId: string): Promise<void> {
    await this.prisma.like.deleteMany({ where: { userId, songId } });
  }

  async isLiked(userId: string, songId: string): Promise<boolean> {
    const like = await this.prisma.like.findUnique({
      where: { userId_songId: { userId, songId } },
    });
    return Boolean(like);
  }

  async findMine(userId: string, query: PaginationQueryDto): Promise<Paginated<unknown>> {
    const where = { userId, song: { deletedAt: null } };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.like.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: "desc" },
        include: {
          song: {
            include: {
              artist: { select: { id: true, name: true, slug: true } },
              album: { select: { id: true, title: true, slug: true, coverUrl: true } },
              genre: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.like.count({ where }),
    ]);

    return {
      items: rows.map((row) => row.song),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }
}
