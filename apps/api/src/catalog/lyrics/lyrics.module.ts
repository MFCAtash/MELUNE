import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { LyricsController } from "./lyrics.controller";
import { LyricsService } from "./lyrics.service";

@Module({
  imports: [PrismaModule],
  controllers: [LyricsController],
  providers: [LyricsService],
  exports: [LyricsService],
})
export class LyricsModule {}
