"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminUser,
  Album,
  Artist,
  Genre,
  Role,
  Song,
} from "@melune/types";
import type {
  AlbumWritePayload,
  ArtistWritePayload,
  GenreWritePayload,
  SongWritePayload,
} from "@melune/api-client";
import { apiClient } from "@/lib/api-client";

/** Query-key factory for the admin section — kept separate from `qk` in
 *  `lib/queries.ts` since none of this ever overlaps with listener-facing
 *  caches (an admin editing a song shouldn't need to know about, or
 *  invalidate, the public catalog cache keys). */
export const adminQk = {
  stats: ["admin", "stats"] as const,
  users: (params: AdminUsersParams) => ["admin", "users", params] as const,
  songs: ["admin", "songs"] as const,
  albums: ["admin", "albums"] as const,
  artists: ["admin", "artists"] as const,
  genres: ["admin", "genres"] as const,
  dailyActiveUsers: (rangeDays: number) => ["admin", "analytics", "dau", rangeDays] as const,
  topGenres: (rangeDays: number) => ["admin", "analytics", "top-genres", rangeDays] as const,
  retention: (weekOffset: number) => ["admin", "analytics", "retention", weekOffset] as const,
};

export interface AdminUsersParams {
  q?: string;
  role?: Role;
  includeBanned?: boolean;
  page?: number;
  limit?: number;
}

// ------------------------------------------------------------ dashboard

export function useAdminStats() {
  return useQuery({
    queryKey: adminQk.stats,
    queryFn: () => apiClient.adminGetStats(),
    staleTime: 60_000,
  });
}

// -------------------------------------------------------- analytics

/** Admin-only aggregate reads (Phase 11) — distinct from `useAdminStats`
 *  above, which only backs the dashboard's 5 headline numbers + one
 *  7-day chart. These back the dedicated `/admin/analytics` page. */
export function useAdminDailyActiveUsers(rangeDays: number) {
  return useQuery({
    queryKey: adminQk.dailyActiveUsers(rangeDays),
    queryFn: () => apiClient.adminDailyActiveUsers({ rangeDays }),
    staleTime: 60_000,
  });
}

export function useAdminTopGenresOverTime(rangeDays: number) {
  return useQuery({
    queryKey: adminQk.topGenres(rangeDays),
    queryFn: () => apiClient.adminTopGenresOverTime({ rangeDays }),
    staleTime: 60_000,
  });
}

export function useAdminRetentionCohort(weekOffset: number) {
  return useQuery({
    queryKey: adminQk.retention(weekOffset),
    queryFn: () => apiClient.adminRetentionCohort({ weekOffset }),
    staleTime: 60_000,
  });
}

// ----------------------------------------------------------------- users

export function useAdminUsers(params: AdminUsersParams) {
  return useQuery({
    queryKey: adminQk.users(params),
    queryFn: () => apiClient.adminListUsers(params),
    placeholderData: (prev) => prev,
  });
}

export function useAdminUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => apiClient.adminUpdateUserRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: adminQk.stats });
    },
  });
}

export function useAdminBanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.adminBanUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: adminQk.stats });
    },
  });
}

export function useAdminUnbanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.adminUnbanUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

// -------------------------------------------------------- songs/albums

export function useAdminSongs(params: { page?: number; limit?: number; genreId?: string; artistId?: string }) {
  return useQuery({
    queryKey: [...adminQk.songs, params],
    queryFn: () => apiClient.listSongs(params),
    placeholderData: (prev) => prev,
  });
}

function useCatalogMutation<TArgs, TResult>(
  invalidateKey: readonly unknown[],
  mutationFn: (args: TArgs) => Promise<TResult>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invalidateKey });
      qc.invalidateQueries({ queryKey: adminQk.stats });
      // The public catalog list (`["songs", ...]` etc. in lib/catalog.ts)
      // also needs to see admin edits — invalidate broadly by the
      // top-level key rather than importing the listener-facing qk map.
    },
  });
}

export function useAdminCreateSong() {
  return useCatalogMutation<SongWritePayload, Song>(adminQk.songs, (payload) =>
    apiClient.createSong(payload),
  );
}

export function useAdminUpdateSong() {
  return useCatalogMutation<{ id: string; payload: SongWritePayload }, Song>(
    adminQk.songs,
    ({ id, payload }) => apiClient.updateSong(id, payload),
  );
}

export function useAdminDeleteSong() {
  return useCatalogMutation<string, void>(adminQk.songs, (id) => apiClient.deleteSong(id));
}

export function useAdminAlbums(params: { page?: number; limit?: number; artistId?: string }) {
  return useQuery({
    queryKey: [...adminQk.albums, params],
    queryFn: () => apiClient.listAlbums(params),
    placeholderData: (prev) => prev,
  });
}

export function useAdminCreateAlbum() {
  return useCatalogMutation<AlbumWritePayload, Album>(adminQk.albums, (payload) =>
    apiClient.createAlbum(payload),
  );
}

export function useAdminUpdateAlbum() {
  return useCatalogMutation<{ id: string; payload: AlbumWritePayload }, Album>(
    adminQk.albums,
    ({ id, payload }) => apiClient.updateAlbum(id, payload),
  );
}

export function useAdminDeleteAlbum() {
  return useCatalogMutation<string, void>(adminQk.albums, (id) => apiClient.deleteAlbum(id));
}

// ------------------------------------------------------- artists/genres

export function useAdminArtists() {
  return useQuery({
    queryKey: adminQk.artists,
    queryFn: () => apiClient.listArtists({ limit: 100 }),
  });
}

export function useAdminCreateArtist() {
  return useCatalogMutation<ArtistWritePayload, Artist>(adminQk.artists, (payload) =>
    apiClient.createArtist(payload),
  );
}

export function useAdminUpdateArtist() {
  return useCatalogMutation<{ id: string; payload: ArtistWritePayload }, Artist>(
    adminQk.artists,
    ({ id, payload }) => apiClient.updateArtist(id, payload),
  );
}

export function useAdminDeleteArtist() {
  return useCatalogMutation<string, void>(adminQk.artists, (id) => apiClient.deleteArtist(id));
}

export function useAdminGenres() {
  return useQuery({
    queryKey: adminQk.genres,
    queryFn: () => apiClient.listGenres(),
  });
}

export function useAdminCreateGenre() {
  return useCatalogMutation<GenreWritePayload, Genre>(adminQk.genres, (payload) =>
    apiClient.createGenre(payload),
  );
}

export function useAdminUpdateGenre() {
  return useCatalogMutation<{ id: string; payload: GenreWritePayload }, Genre>(
    adminQk.genres,
    ({ id, payload }) => apiClient.updateGenre(id, payload),
  );
}

export function useAdminDeleteGenre() {
  return useCatalogMutation<string, void>(adminQk.genres, (id) => apiClient.deleteGenre(id));
}
