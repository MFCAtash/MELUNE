import { Body, Controller, Delete, Get, Param, Put } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Public } from "../../auth/decorators/public.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { UploadLyricsDto } from "./dto/upload-lyrics.dto";
import { LyricsService } from "./lyrics.service";

@Controller("lyrics")
export class LyricsController {
  constructor(private readonly lyrics: LyricsService) {}

  /** Read-only, public: the player needs lyrics for anonymous listeners too. */
  @Public()
  @Get(":songId")
  get(@Param("songId") songId: string) {
    return this.lyrics.getForSong(songId);
  }

  /** Upload/replace a synced `.lrc` document (artists may edit their own
   *  catalogue entries via the same role used for song CRUD). */
  @Roles(Role.ARTIST, Role.ADMIN)
  @Put(":songId")
  upload(@Param("songId") songId: string, @Body() dto: UploadLyricsDto) {
    return this.lyrics.upload(songId, dto);
  }

  @Roles(Role.ARTIST, Role.ADMIN)
  @Delete(":songId")
  remove(@Param("songId") songId: string) {
    return this.lyrics.remove(songId);
  }
}
