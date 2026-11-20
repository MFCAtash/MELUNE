export type Role = "USER" | "ARTIST" | "ADMIN";

export interface User {
  id: string;
  email: string;
  username: string;
  role: Role;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthStatus {
  status: "ok" | "error";
  info?: Record<string, { status: string }>;
  error?: Record<string, { status: string }>;
}

// ---- Auth (Phase 2) ----

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// ---- Catalog (Phase 3) ----

export interface Genre {
  id: string;
  name: string;
  slug: string;
}

export interface ArtistSummary {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

export interface AlbumSummary {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
}

export interface Song {
  id: string;
  title: string;
  slug: string;
  duration: number;
  audioUrl: string;
  coverUrl: string | null;
  /** HLS master-playlist URL, populated asynchronously after upload.
   *  `null` until the transcode job finishes (or if it fails) — the
   *  web player always falls back to `audioUrl` in that case. */
  hlsPlaylistUrl?: string | null;
  playCount: number;
  artist: ArtistSummary;
  album: AlbumSummary | null;
  genre: Genre | null;
  /** Optional content-features used by the recommendation engine — see RecommendationsService. */
  bpm?: number | null;
  mood?: string | null;
  energy?: number | null;
}

export interface Album {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  releaseDate: string | null;
  artist: ArtistSummary;
  songs: Song[];
}

export interface Artist {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  imageUrl: string | null;
  albums: AlbumSummary[];
  songs: Song[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---- Library (Phase 5) ----

export interface PlaylistOwner {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface PlaylistSummary {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  /** Hex color chosen from the brand swatch picker, or null to fall back
   *  to the deterministic per-id palette (see lib/cover.ts on the web app). */
  accentColor: string | null;
  isPublic: boolean;
  /** Present on public/detail responses; absent on `GET /playlists/me`
   *  and on a freshly created playlist (the caller is the owner). */
  owner?: PlaylistOwner;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistEntry {
  id: string;
  position: number;
  addedAt: string;
  song: Song;
}

export interface Playlist extends PlaylistSummary {
  items: PlaylistEntry[];
}

export type LibraryItemType = "ALBUM" | "ARTIST" | "PLAYLIST";

export interface LibraryItem {
  id: string;
  itemType: LibraryItemType;
  createdAt: string;
  /** The API returns the saved entity without its nested song lists. */
  album: Omit<Album, "songs"> | null;
  artist: Omit<Artist, "songs" | "albums"> | null;
  playlist: PlaylistSummary | null;
}

// ---- Discover (Phase 5) ----

export interface HomeFeed {
  recentlyPlayed: Song[];
  trending: Song[];
  /** null when the user has no listening history yet. */
  madeForYou: Song[] | null;
}

// ---- Users ----

export interface UserStats {
  likes: number;
  playlists: number;
  plays: number;
}

// ---- Recommendations (Phase 8.2) ----
// Content-based cosine-similarity engine over genre + artist + bpm/mood/energy.
// See apps/api/src/recommendations and docs/ai.md.

export interface RecommendedSong {
  song: Song;
  /** Cosine similarity between the user's taste profile and this song, 0..1. */
  score: number;
}

export interface RecommendationsResult {
  items: RecommendedSong[];
  /** Why there might be fewer/no results — never silently padded with unrelated songs. */
  basis: "profile" | "none";
}

// ---- Admin (Phase 8.2) ----

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: Role;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isArtist: boolean;
}

export interface AdminStats {
  totals: {
    users: number;
    artists: number;
    songs: number;
    albums: number;
    playlists: number;
  };
  newUsersLast7Days: number;
  playsLast7Days: number;
  topSongs: Song[];
  usersByDay: { date: string; count: number }[];
}

// ---- Admin analytics (Phase 11) — DAU, genre trends, retention cohorts.
// Separate from AdminStats above (that's the dashboard's 5 headline
// numbers + one 7-day chart); these back the dedicated /admin/analytics
// page's own charts, each over a caller-chosen range/cohort. ----

export interface DailyActiveUsersResult {
  rangeDays: number;
  since: string;
  series: { date: string; count: number }[];
}

export interface TopGenresOverTimeResult {
  rangeDays: number;
  since: string;
  /** Stable id/name pairs for every key present in each `series[n].counts`
   *  object — at most 5 real genres plus a synthetic `"other"` bucket
   *  (id `"other"`) when more than 5 genres had plays in range. */
  genres: { id: string; name: string }[];
  series: { date: string; counts: Record<string, number> }[];
}

export interface RetentionCohortResult {
  weekOffset: number;
  cohortWeekStart: string;
  cohortWeekEnd: string;
  returnWeekStart: string;
  returnWeekEnd: string;
  /** False while the return window hasn't fully elapsed yet (always
   *  false for weekOffset 0) — treat retentionRate as provisional. */
  isReturnWeekComplete: boolean;
  cohortSize: number;
  returnedCount: number;
  /** null (not 0) when the cohort itself had no signups to measure. */
  retentionRate: number | null;
}

// ---- Search (Phase 6) ----

export type SearchType = "all" | "songs" | "artists" | "albums" | "playlists";

/** The shapes returned for each group are summaries, matching what
 *  LibraryItem already uses for saved albums/artists — no nested song lists. */
export type SearchArtist = Omit<Artist, "songs" | "albums">;
export type SearchAlbum = Omit<Album, "songs">;

export interface SearchAllResult {
  query: string;
  songs: Song[];
  artists: SearchArtist[];
  albums: SearchAlbum[];
  playlists: PlaylistSummary[];
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  createdAt: string;
}

// ---- Direct-to-bucket uploads (Phase 12) — mirrors
// `apps/api/src/storage/storage.constants.ts`'s `UploadKind` and
// `StorageService`'s `PresignedUpload` return shape. Kept as a plain
// string union/interface here (not imported from the API package,
// which is server-only) so both the web and mobile clients can share
// one typed contract for `POST /uploads/presign`. ----

export type UploadKind = "audio" | "cover" | "avatar";

export interface PresignedUpload {
  /** PUT the file to this URL directly from the browser, with the exact contentType used to request it. */
  uploadUrl: string;
  /** The permanent, publicly reachable URL — save this as audioUrl/coverUrl/avatarUrl once the PUT succeeds. */
  publicUrl: string;
  /** Object key inside the bucket, exposed in case a caller needs to reference/delete it later. */
  key: string;
  expiresInSeconds: number;
}

// ---- Notifications (Phase 13) — mirrors apps/api/src/notifications;
// `type` matches NotificationsService's NotificationType catalog
// ("new_release" | "welcome" today) but is kept as `string` here so
// the client doesn't need updating every time the API adds a type. ----

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

