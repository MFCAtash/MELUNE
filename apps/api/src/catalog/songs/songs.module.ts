import { Module } from "@nestjs/common";
import { SongsController } from "./songs.controller";
import { SongsService } from "./songs.service";
import { ArtistsModule } from "../artists/artists.module";

@Module({
  imports: [ArtistsModule],
  controllers: [SongsController],
  providers: [SongsService],
  exports: [SongsService],
})
export class SongsModule {}
