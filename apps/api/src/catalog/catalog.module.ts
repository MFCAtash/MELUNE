import { Module } from "@nestjs/common";
import { GenresModule } from "./genres/genres.module";
import { ArtistsModule } from "./artists/artists.module";
import { AlbumsModule } from "./albums/albums.module";
import { SongsModule } from "./songs/songs.module";
import { LyricsModule } from "./lyrics/lyrics.module";

@Module({
  imports: [GenresModule, ArtistsModule, AlbumsModule, SongsModule, LyricsModule],
})
export class CatalogModule {}
