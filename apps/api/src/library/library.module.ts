import { Module } from "@nestjs/common";
import { LikesModule } from "./likes/likes.module";
import { PlaylistsModule } from "./playlists/playlists.module";
import { SavedItemsModule } from "./saved-items/saved-items.module";
import { HistoryModule } from "./history/history.module";

/** Phase 5 — everything the signed-in user owns: likes, playlists, saved
 *  albums/artists/playlists, and listening history. */
@Module({
  imports: [LikesModule, PlaylistsModule, SavedItemsModule, HistoryModule],
  exports: [LikesModule, PlaylistsModule, SavedItemsModule, HistoryModule],
})
export class UserLibraryModule {}
