import { Module } from "@nestjs/common";
import { GenresModule } from "./genres/genres.module";
import { ArtistsModule } from "./artists/artists.module";
import { AlbumsModule } from "./albums/albums.module";
import { SongsModule } from "./songs/songs.module";

@Module({
  imports: [GenresModule, ArtistsModule, AlbumsModule, SongsModule],
})
export class CatalogModule {}
