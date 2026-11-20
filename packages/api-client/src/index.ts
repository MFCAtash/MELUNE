import type {
  Album,
  AdminStats,
  AdminUser,
  Artist,
  AuthResponse,
  DailyActiveUsersResult,
  Genre,
  HomeFeed,
  LibraryItem,
  LoginPayload,
  Notification,
  Paginated,
  Playlist,
  PlaylistSummary,
  PresignedUpload,
  RecommendationsResult,
  RegisterPayload,
  RetentionCohortResult,
  Role,
  SearchAlbum,
  SearchAllResult,
  SearchArtist,
  SearchHistoryEntry,
  Song,
  TopGenresOverTimeResult,
  UploadKind,
  User,
  UserStats,
} from "@codex-music/types";

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken: () => string | null;
  onTokenRefreshed: (accessToken: string | null) => void;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---- Catalog write payloads (Phase 3 read, Phase 8.2 admin write) ----

export interface SongWritePayload {
  title?: string;
  albumId?: string;
  genreId?: string;
  duration?: number;
  audioUrl?: string;
  coverUrl?: string;
  bpm?: number;
  mood?: string;
  energy?: number;
  /** Admin-only: which artist to create the song under. Ignored on update. */
  artistId?: string;
}

export interface AlbumWritePayload {
  title?: string;
  coverUrl?: string;
  releaseDate?: string;
  /** Admin-only: which artist to create the album under. Ignored on update. */
  artistId?: string;
}

export interface ArtistWritePayload {
  name?: string;
  bio?: string;
  imageUrl?: string;
}

export interface GenreWritePayload {
  name?: string;
}

/**
 * Thin fetch wrapper shared across clients.
 * - Sends the access token as a Bearer header.
 * - Sends cookies (`credentials: "include"`) so the httpOnly refresh
 *   cookie set by the API travels with every request.
 * - On a 401, tries exactly one silent refresh before failing, so a
 *   short-lived access token doesn't force a full re-login on every
 *   page load.
 */
export class ApiClient {
  private refreshing: Promise<string | null> | null = null;

  constructor(private readonly options: ApiClientOptions) {}

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    this.options.onTokenRefreshed(res.accessToken);
    return res;
  }

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    this.options.onTokenRefreshed(res.accessToken);
    return res;
  }

  async logout(): Promise<void> {
    await this.request<void>("/auth/logout", { method: "POST" });
    this.options.onTokenRefreshed(null);
  }

  async forgotPassword(email: string): Promise<void> {
    await this.request<void>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.request<void>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>("/users/me", { method: "GET" });
  }

  async getMyStats(): Promise<UserStats> {
    return this.request<UserStats>("/users/me/stats", { method: "GET" });
  }

  // ---- Catalog (Phase 3, all public) ----

  async listSongs(params?: {
    artistId?: string;
    albumId?: string;
    genreId?: string;
    page?: number;
    limit?: number;
  }): Promise<Paginated<Song>> {
    return this.request<Paginated<Song>>(`/songs${toQuery(params)}`, { method: "GET" });
  }

  async getSong(idOrSlug: string): Promise<Song> {
    return this.request<Song>(`/songs/${idOrSlug}`, { method: "GET" });
  }

  async listAlbums(params?: { artistId?: string; page?: number; limit?: number }): Promise<Paginated<Album>> {
    return this.request<Paginated<Album>>(`/albums${toQuery(params)}`, { method: "GET" });
  }

  async getAlbum(idOrSlug: string): Promise<Album> {
    return this.request<Album>(`/albums/${idOrSlug}`, { method: "GET" });
  }

  async listArtists(params?: { page?: number; limit?: number }): Promise<Paginated<Artist>> {
    return this.request<Paginated<Artist>>(`/artists${toQuery(params)}`, { method: "GET" });
  }

  async getArtist(idOrSlug: string): Promise<Artist> {
    return this.request<Artist>(`/artists/${idOrSlug}`, { method: "GET" });
  }

  async listGenres(): Promise<Genre[]> {
    return this.request<Genre[]>("/genres", { method: "GET" });
  }

  async getGenre(idOrSlug: string): Promise<Genre> {
    return this.request<Genre>(`/genres/${idOrSlug}`, { method: "GET" });
  }

  // ---- Catalog writes (artists self-serve their own; ADMIN can target any) ----

  async createSong(payload: SongWritePayload): Promise<Song> {
    return this.request<Song>("/songs", { method: "POST", body: JSON.stringify(payload) });
  }

  async updateSong(id: string, payload: SongWritePayload): Promise<Song> {
    return this.request<Song>(`/songs/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  }

  async deleteSong(id: string): Promise<void> {
    await this.request<void>(`/songs/${id}`, { method: "DELETE" });
  }

  async createAlbum(payload: AlbumWritePayload): Promise<Album> {
    return this.request<Album>("/albums", { method: "POST", body: JSON.stringify(payload) });
  }

  async updateAlbum(id: string, payload: AlbumWritePayload): Promise<Album> {
    return this.request<Album>(`/albums/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  }

  async deleteAlbum(id: string): Promise<void> {
    await this.request<void>(`/albums/${id}`, { method: "DELETE" });
  }

  /** As a plain ARTIST this creates the caller's own profile; as ADMIN it creates an unowned catalog artist. */
  async createArtist(payload: ArtistWritePayload): Promise<Artist> {
    return this.request<Artist>("/artists", { method: "POST", body: JSON.stringify(payload) });
  }

  async updateArtist(id: string, payload: ArtistWritePayload): Promise<Artist> {
    return this.request<Artist>(`/artists/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  }

  async deleteArtist(id: string): Promise<void> {
    await this.request<void>(`/artists/${id}`, { method: "DELETE" });
  }

  async createGenre(payload: GenreWritePayload): Promise<Genre> {
    return this.request<Genre>("/genres", { method: "POST", body: JSON.stringify(payload) });
  }

  async updateGenre(id: string, payload: GenreWritePayload): Promise<Genre> {
    return this.request<Genre>(`/genres/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  }

  async deleteGenre(id: string): Promise<void> {
    await this.request<void>(`/genres/${id}`, { method: "DELETE" });
  }

  // ---- Recommendations (Phase 8.2) ----

  async getForYou(limit?: number): Promise<RecommendationsResult> {
    return this.request<RecommendationsResult>(`/recommendations/for-you${toQuery({ limit })}`, {
      method: "GET",
    });
  }

  // ---- Direct-to-bucket uploads (Phase 12) ----
  // The API only ever hands back a short-lived presigned PUT url; the
  // actual file bytes go straight from the browser to the bucket (see
  // `usePresignedUpload` in the web app), never through this client/the
  // API process.

  async presignUpload(payload: {
    kind: UploadKind;
    filename: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<PresignedUpload> {
    return this.request<PresignedUpload>("/uploads/presign", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // ---- Admin (Phase 8.2) ----

  async adminGetStats(): Promise<AdminStats> {
    return this.request<AdminStats>("/admin/stats", { method: "GET" });
  }

  async adminListUsers(params?: {
    q?: string;
    role?: Role;
    includeBanned?: boolean;
    page?: number;
    limit?: number;
  }): Promise<Paginated<AdminUser>> {
    return this.request<Paginated<AdminUser>>(
      `/admin/users${toQuery({ ...params, includeBanned: params?.includeBanned ? "true" : undefined })}`,
      { method: "GET" },
    );
  }

  async adminUpdateUserRole(id: string, role: Role): Promise<AdminUser> {
    return this.request<AdminUser>(`/admin/users/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  }

  async adminBanUser(id: string): Promise<AdminUser> {
    return this.request<AdminUser>(`/admin/users/${id}/ban`, { method: "PATCH" });
  }

  async adminUnbanUser(id: string): Promise<AdminUser> {
    return this.request<AdminUser>(`/admin/users/${id}/unban`, { method: "PATCH" });
  }

  // ---- Admin analytics (Phase 11) ----

  async adminDailyActiveUsers(params?: { rangeDays?: number }): Promise<DailyActiveUsersResult> {
    return this.request<DailyActiveUsersResult>(
      `/admin/analytics/daily-active-users${toQuery(params)}`,
      { method: "GET" },
    );
  }

  async adminTopGenresOverTime(params?: { rangeDays?: number }): Promise<TopGenresOverTimeResult> {
    return this.request<TopGenresOverTimeResult>(`/admin/analytics/top-genres${toQuery(params)}`, {
      method: "GET",
    });
  }

  async adminRetentionCohort(params?: { weekOffset?: number }): Promise<RetentionCohortResult> {
    return this.request<RetentionCohortResult>(`/admin/analytics/retention${toQuery(params)}`, {
      method: "GET",
    });
  }

  // ---- Discover (Phase 5) ----
  // Public — personalizes automatically when a token is attached.

  async getHome(): Promise<HomeFeed> {
    return this.request<HomeFeed>("/discover/home", { method: "GET" });
  }

  // ---- Likes (Phase 5) ----

  async likeSong(songId: string): Promise<void> {
    await this.request<void>(`/songs/${songId}/like`, { method: "POST" });
  }

  async unlikeSong(songId: string): Promise<void> {
    await this.request<void>(`/songs/${songId}/like`, { method: "DELETE" });
  }

  async listMyLikes(params?: { page?: number; limit?: number }): Promise<Paginated<Song>> {
    return this.request<Paginated<Song>>(`/me/likes${toQuery(params)}`, { method: "GET" });
  }

  // ---- History (Phase 5) ----

  /** Fire-and-forget from the player: records a play and bumps playCount. */
  async recordPlay(songId: string): Promise<void> {
    await this.request<void>(`/me/history/${songId}`, { method: "POST" });
  }

  async listMyHistory(params?: { limit?: number }): Promise<Song[]> {
    return this.request<Song[]>(`/me/history${toQuery(params)}`, { method: "GET" });
  }

  // ---- Playlists (Phase 5) ----

  async listPublicPlaylists(params?: { page?: number }): Promise<Paginated<PlaylistSummary>> {
    return this.request<Paginated<PlaylistSummary>>(`/playlists${toQuery(params)}`, {
      method: "GET",
    });
  }

  async listMyPlaylists(params?: { page?: number; limit?: number }): Promise<Paginated<PlaylistSummary>> {
    return this.request<Paginated<PlaylistSummary>>(`/playlists/me${toQuery(params)}`, {
      method: "GET",
    });
  }

  async getPlaylist(idOrSlug: string): Promise<Playlist> {
    return this.request<Playlist>(`/playlists/${idOrSlug}`, { method: "GET" });
  }

  async createPlaylist(payload: {
    title: string;
    description?: string;
    coverUrl?: string;
    accentColor?: string | null;
    isPublic?: boolean;
  }): Promise<PlaylistSummary> {
    return this.request<PlaylistSummary>("/playlists", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updatePlaylist(
    id: string,
    payload: {
      title?: string;
      description?: string;
      coverUrl?: string;
      accentColor?: string | null;
      isPublic?: boolean;
    },
  ): Promise<PlaylistSummary> {
    return this.request<PlaylistSummary>(`/playlists/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  /** `songIds` is the complete new ordering — every song exactly once. */
  async reorderPlaylistSongs(id: string, songIds: string[]): Promise<void> {
    await this.request<void>(`/playlists/${id}/songs/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ songIds }),
    });
  }

  async deletePlaylist(id: string): Promise<void> {
    await this.request<void>(`/playlists/${id}`, { method: "DELETE" });
  }

  async addSongToPlaylist(playlistId: string, songId: string): Promise<void> {
    await this.request<void>(`/playlists/${playlistId}/songs`, {
      method: "POST",
      body: JSON.stringify({ songId }),
    });
  }

  async removeSongFromPlaylist(playlistId: string, songId: string): Promise<void> {
    await this.request<void>(`/playlists/${playlistId}/songs/${songId}`, {
      method: "DELETE",
    });
  }

  // ---- Library — saved albums/artists/playlists (Phase 5) ----

  async listMyLibrary(params?: {
    type?: "album" | "artist" | "playlist";
    page?: number;
    limit?: number;
  }): Promise<Paginated<LibraryItem>> {
    return this.request<Paginated<LibraryItem>>(`/me/library${toQuery(params)}`, {
      method: "GET",
    });
  }

  async saveToLibrary(type: "albums" | "artists" | "playlists", id: string): Promise<void> {
    await this.request<void>(`/me/library/${type}/${id}`, { method: "POST" });
  }

  async removeFromLibrary(type: "albums" | "artists" | "playlists", id: string): Promise<void> {
    await this.request<void>(`/me/library/${type}/${id}`, { method: "DELETE" });
  }

  // ---- Search (Phase 6) ----
  // Public — logged-out visitors can search too — but the Cmd+K palette
  // and this quick preview should never be the thing that reveals a
  // private playlist, so `searchPlaylists` only ever returns public ones
  // (enforced server-side, not here).

  /** Small preview of every type at once — what the Cmd+K palette calls on each keystroke. */
  async quickSearch(q: string): Promise<SearchAllResult> {
    return this.request<SearchAllResult>(`/search${toQuery({ q, type: "all" })}`, {
      method: "GET",
    });
  }

  async searchSongs(q: string, params?: { page?: number; limit?: number }): Promise<Paginated<Song>> {
    return this.request<Paginated<Song>>(`/search${toQuery({ q, type: "songs", ...params })}`, {
      method: "GET",
    });
  }

  async searchArtists(
    q: string,
    params?: { page?: number; limit?: number },
  ): Promise<Paginated<SearchArtist>> {
    return this.request<Paginated<SearchArtist>>(
      `/search${toQuery({ q, type: "artists", ...params })}`,
      { method: "GET" },
    );
  }

  async searchAlbums(
    q: string,
    params?: { page?: number; limit?: number },
  ): Promise<Paginated<SearchAlbum>> {
    return this.request<Paginated<SearchAlbum>>(
      `/search${toQuery({ q, type: "albums", ...params })}`,
      { method: "GET" },
    );
  }

  async searchPlaylists(
    q: string,
    params?: { page?: number; limit?: number },
  ): Promise<Paginated<PlaylistSummary>> {
    return this.request<Paginated<PlaylistSummary>>(
      `/search${toQuery({ q, type: "playlists", ...params })}`,
      { method: "GET" },
    );
  }

  /** Records one *committed* search — call on Enter or on picking a result, never per keystroke. */
  async recordSearchHistory(query: string): Promise<void> {
    await this.request<void>("/search/history", { method: "POST", body: JSON.stringify({ query }) });
  }

  async listSearchHistory(): Promise<SearchHistoryEntry[]> {
    return this.request<SearchHistoryEntry[]>("/search/history", { method: "GET" });
  }

  async clearSearchHistory(): Promise<void> {
    await this.request<void>("/search/history", { method: "DELETE" });
  }

  // ---- Push notifications (Phase 8) ----

  async subscribeToPush(subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
  }): Promise<void> {
    await this.request<void>("/me/push/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription),
    });
  }

  async unsubscribeFromPush(endpoint: string): Promise<void> {
    await this.request<void>("/me/push/subscribe", {
      method: "DELETE",
      body: JSON.stringify({ endpoint }),
    });
  }

  // ---- In-app notifications (Phase 13) — see also
  // hooks/use-notifications-socket.ts for the real-time half of this
  // (NotificationsGateway), which invalidates whatever query key these
  // two calls are used under instead of the caller needing to poll. ----

  async getMyNotifications(params?: { page?: number; limit?: number }): Promise<Paginated<Notification>> {
    return this.request<Paginated<Notification>>(
      `/me/notifications${toQuery({ page: params?.page, limit: params?.limit })}`,
      { method: "GET" },
    );
  }

  async getUnreadNotificationCount(): Promise<number> {
    const res = await this.request<{ count: number }>("/me/notifications/unread-count", { method: "GET" });
    return res.count;
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.request<void>(`/me/notifications/${id}/read`, { method: "PATCH" });
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.request<void>("/me/notifications/read-all", { method: "POST" });
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshing) {
      this.refreshing = this.request<AuthResponse>("/auth/refresh", {
        method: "POST",
      })
        .then((res) => {
          this.options.onTokenRefreshed(res.accessToken);
          return res.accessToken;
        })
        .catch(() => {
          this.options.onTokenRefreshed(null);
          return null;
        })
        .finally(() => {
          this.refreshing = null;
        });
    }
    return this.refreshing;
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    isRetry = false,
  ): Promise<T> {
    const token = this.options.getAccessToken();

    const res = await fetch(`${this.options.baseUrl}/api${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

    if (res.status === 401 && !isRetry && path !== "/auth/refresh") {
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        return this.request<T>(path, init, true);
      }
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: res.statusText }));
      const message = Array.isArray(body.message)
        ? body.message.join(", ")
        : body.message;
      throw new ApiError(res.status, message ?? "Request failed");
    }

    if (res.status === 204) {
      return undefined as T;
    }

    // Some endpoints (e.g. playlist reorder) answer 200 with an empty
    // body — res.json() would throw on those, so parse defensively.
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}

function toQuery(params?: Record<string, string | number | undefined>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return "";
  const qs = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString();
  return `?${qs}`;
}
