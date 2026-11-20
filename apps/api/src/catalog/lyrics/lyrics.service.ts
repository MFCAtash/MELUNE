import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { parseLrc, type ParsedLyricLine } from "./lrc.parser";
import type { UploadLyricsDto } from "./dto/upload-lyrics.dto";

@Injectable()
export class LyricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public read. `null` is a normal "not available yet" state, never an error. */
  async getForSong(songId: string) {
    const document = await this.prisma.lyric.findUnique({ where: { songId } });
    if (!document) return null;
    return {
      songId: document.songId,
      lines: document.lines as unknown as ParsedLyricLine[],
      language: document.language,
      content: document.content,
      updatedAt: document.updatedAt,
    };
  }

  /** Upload/replace a `.lrc` document. Accepts either the song's id or slug. */
  async upload(songIdOrSlug: string, dto: UploadLyricsDto) {
    const song = await this.prisma.song.findFirst({
      where: { OR: [{ id: songIdOrSlug }, { slug: songIdOrSlug }], deletedAt: null },
      select: { id: true },
    });
    if (!song) throw new NotFoundException("Song not found");

    const lines = parseLrc(dto.content);
    if (lines.length === 0) {
      throw new BadRequestException("No timed lyric lines found — expected lines like [00:12.34]text");
    }

    const payload = {
      content: dto.content,
      lines: lines as unknown as Prisma.InputJsonValue,
      language: dto.language?.trim() || "und",
    };
    return this.prisma.lyric.upsert({
      where: { songId: song.id },
      create: { songId: song.id, ...payload },
      update: payload,
    });
  }

  async remove(songId: string) {
    await this.prisma.lyric.deleteMany({ where: { songId } });
  }
}
