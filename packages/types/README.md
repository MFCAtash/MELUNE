# @codex-music/types

The single source of truth for domain and transport types shared by the web app,
the mobile app and (where useful) the API.

**Rules:**

1. Add shared shapes here — never redeclare them in `apps/web`, `apps/mobile` or
   `apps/api` response types.
2. These are *type-only* exports. No runtime code, no enums that would require a
   transformation step; use string union types so values are comparable across
   bundles.
3. Keep names honest. A `Song` returned by the list endpoint is a `Song`; a
   summary variant gets an explicit `*Summary` name.
4. When the API adds a field, update this package and every consumer in the same
   commit.

## Current groups

| Group | Types |
| --- | --- |
| Accounts | `Role`, `User`, `RegisterPayload`, `LoginPayload`, `AuthResponse`, `ApiErrorBody` |
| Catalog | `Genre`, `ArtistSummary`, `AlbumSummary`, `Song`, `Album`, `Artist` |
| Transport | `Paginated<T>` (items/page/limit/total/totalPages) |
| Library | `PlaylistOwner`, `PlaylistSummary`, `PlaylistEntry`, `Playlist`, `LibraryItemType`, `LibraryItem` |
| Discovery & recommendations | `HomeFeed`, `RecommendedSong`, `RecommendationsResult` |
| Search | `SearchType`, `SearchArtist`, `SearchAlbum`, `SearchAllResult`, `SearchHistoryEntry` |
| Media & uploads | `UploadKind`, `PresignedUpload` |
| Admin & analytics | `AdminUser`, `AdminStats`, `DailyActiveUsersResult`, `TopGenresOverTimeResult`, `RetentionCohortResult` |
| Platform | `HealthStatus`, `Notification` |

## Usage

```ts
import type { Song, Paginated } from "@codex-music/types";

const res: Paginated<Song> = await fetchSongs();
```

## Related packages

- [`@codex-music/api-client`](../api-client) — the typed fetch wrapper built on
  these types.
- [`packages/config/eslint-base.js`](../config/eslint-base.js) — shared lint preset.
