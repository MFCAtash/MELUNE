"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import type {
  LibraryItem,
  Notification,
  Paginated,
  Playlist,
  SearchType,
} from "@melune/types";
import { apiClient } from "@/lib/api-client";
import { catalog } from "@/lib/catalog";
import { useAuthStore } from "@/store/auth-store";
import { getOnboardingGenreIds } from "@/lib/onboarding";

export type SavableType = "album" | "artist" | "playlist";
const PLURAL = { album: "albums", artist: "artists", playlist: "playlists" } as const;

/** Central query-key factory — every cache read/write/invalidate goes through here. */
export const qk = {
  home: (uid: string | null) => ["home", uid] as const,
  stats: (uid: string | null) => ["stats", uid] as const,
  playlists: {
    all: ["playlists"] as const,
    mine: ["playlists", "mine"] as const,
    detail: (key: string, uid: string | null) => ["playlists", "detail", key, uid] as const,
    detailPrefix: ["playlists", "detail"] as const,
  },
  library: {
    all: ["library"] as const,
    list: (type: SavableType) => ["library", "list", type] as const,
    ids: (type: SavableType) => ["library", "ids", type] as const,
  },
  likes: {
    list: ["likes", "list"] as const,
    ids: ["likes", "ids"] as const,
  },
  search: {
    quick: (q: string) => ["search", "quick", q] as const,
    typed: (type: SearchType, q: string) => ["search", "typed", type, q] as const,
    history: ["search", "history"] as const,
  },
  notifications: {
    list: (uid: string | null) => ["notifications", "list", uid] as const,
    unreadCount: (uid: string | null) => ["notifications", "unread-count", uid] as const,
  },
};

const PAGE_SIZE = 30;
// Enough to know the like/saved state of everything visible on screen.
// Beyond this an older item would look unliked/unsaved — a known,
// documented limit until Song responses carry a per-viewer `isLiked`.
const IDS_LIMIT = 100;

function nextPage<T>(last: Paginated<T>): number | undefined {
  return last.page < last.totalPages ? last.page + 1 : undefined;
}

export function flatItems<T>(data: InfiniteData<Paginated<T>> | undefined): T[] {
  return data?.pages.flatMap((p) => p.items) ?? [];
}

function useUserId() {
  return useAuthStore((s) => s.user?.id ?? null);
}

// ---------------------------------------------------------------- Home

/** Personalized when logged in, trending-only for guests (public endpoint). */
export function useHomeFeed() {
  const uid = useUserId();
  const ready = useAuthStore((s) => s.ready);
  return useQuery({
    queryKey: qk.home(uid),
    queryFn: () => apiClient.getHome(),
    enabled: ready,
  });
}

/** Likes/playlists/plays counts for the profile stats panel. Logged-in only. */
export function useMyStats() {
  const uid = useUserId();
  const ready = useAuthStore((s) => s.ready);
  return useQuery({
    queryKey: qk.stats(uid),
    queryFn: () => apiClient.getMyStats(),
    enabled: ready && uid !== null,
  });
}

/** All genres — the onboarding picker's checklist. Public endpoint, rarely changes. */
export function useGenres() {
  return useQuery({
    queryKey: ["genres"],
    queryFn: () => catalog.listGenres(),
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * Fallback "Made for you" seed built from the onboarding genre picks,
 * client-side only (see lib/onboarding.ts). Only enabled when the real
 * history-based feed came back empty — never races or overwrites it.
 */
export function useOnboardingSeedSongs(enabled: boolean) {
  const genreIds = getOnboardingGenreIds();
  return useQuery({
    queryKey: ["onboarding-seed", genreIds],
    queryFn: async () => {
      const perGenre = await Promise.all(
        genreIds.slice(0, 5).map((id) => catalog.listSongsByGenre(id)),
      );
      // Interleave rather than concatenate genre-by-genre, so the mix
      // doesn't open with five songs from whichever genre sorts first.
      const rows = perGenre.map((p) => p?.items ?? []);
      const mixed: (typeof rows)[number] = [];
      for (let i = 0; mixed.length < 20 && rows.some((r) => r[i]); i++) {
        for (const row of rows) if (row[i]) mixed.push(row[i]);
      }
      return mixed.slice(0, 20);
    },
    enabled: enabled && genreIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// ----------------------------------------------------------- Playlists

export function useMyPlaylists(enabled = true) {
  const uid = useUserId();
  return useInfiniteQuery({
    queryKey: qk.playlists.mine,
    queryFn: ({ pageParam }) => apiClient.listMyPlaylists({ page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: enabled && Boolean(uid),
  });
}

export function playlistDetailKey(key: string, uid: string | null) {
  return qk.playlists.detail(key, uid);
}

export function usePlaylist(key: string) {
  const uid = useUserId();
  const ready = useAuthStore((s) => s.ready);
  return useQuery({
    queryKey: qk.playlists.detail(key, uid),
    queryFn: () => apiClient.getPlaylist(key),
    enabled: ready,
  });
}

export function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      title: string;
      description?: string;
      accentColor?: string | null;
      isPublic?: boolean;
    }) => apiClient.createPlaylist(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.playlists.mine }),
  });
}

export function useUpdatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      title?: string;
      description?: string;
      accentColor?: string | null;
      isPublic?: boolean;
    }) => apiClient.updatePlaylist(id, payload),
    // A rename changes the slug too, so refresh every playlist view.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.playlists.all }),
  });
}

export function useDeletePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deletePlaylist(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.playlists.all });
      qc.invalidateQueries({ queryKey: qk.library.all });
    },
  });
}

export function useAddSongToPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, songId }: { playlistId: string; songId: string }) =>
      apiClient.addSongToPlaylist(playlistId, songId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.playlists.detailPrefix }),
  });
}

/** Optimistic remove from a playlist detail cache entry. */
export function useRemoveSongFromPlaylist(detailKey: readonly unknown[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, songId }: { playlistId: string; songId: string }) =>
      apiClient.removeSongFromPlaylist(playlistId, songId),
    onMutate: async ({ songId }) => {
      await qc.cancelQueries({ queryKey: detailKey });
      const prev = qc.getQueryData<Playlist>(detailKey);
      qc.setQueryData<Playlist>(detailKey, (old) =>
        old ? { ...old, items: old.items.filter((i) => i.song.id !== songId) } : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(detailKey, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: detailKey }),
  });
}

/** Optimistic reorder: the list moves instantly, rolls back if the API rejects it. */
export function useReorderPlaylist(detailKey: readonly unknown[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, songIds }: { playlistId: string; songIds: string[] }) =>
      apiClient.reorderPlaylistSongs(playlistId, songIds),
    onMutate: async ({ songIds }) => {
      await qc.cancelQueries({ queryKey: detailKey });
      const prev = qc.getQueryData<Playlist>(detailKey);
      qc.setQueryData<Playlist>(detailKey, (old) => {
        if (!old) return old;
        const byId = new Map(old.items.map((i) => [i.song.id, i]));
        const items = songIds
          .map((id, position) => {
            const entry = byId.get(id);
            return entry ? { ...entry, position } : null;
          })
          .filter((e): e is Playlist["items"][number] => e !== null);
        return { ...old, items };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(detailKey, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: detailKey }),
  });
}

// -------------------------------------------------------------- Library

export function useMyLibrary(type: "album" | "artist" | "playlist", enabled = true) {
  const uid = useUserId();
  return useInfiniteQuery({
    queryKey: qk.library.list(type),
    queryFn: ({ pageParam }) => apiClient.listMyLibrary({ type, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: enabled && Boolean(uid),
  });
}

function libraryItemId(item: LibraryItem): string | undefined {
  return item.album?.id ?? item.artist?.id ?? item.playlist?.id;
}

/** IDs the user has saved of one type — powers the Save/Saved button state. */
export function useSavedIds(type: SavableType) {
  const uid = useUserId();
  return useQuery({
    queryKey: qk.library.ids(type),
    queryFn: async () => {
      const page = await apiClient.listMyLibrary({ type, limit: IDS_LIMIT });
      return page.items.map(libraryItemId).filter((id): id is string => Boolean(id));
    },
    enabled: Boolean(uid),
    staleTime: 5 * 60_000,
  });
}

export function useToggleSaved(type: SavableType) {
  const qc = useQueryClient();
  const idsKey = qk.library.ids(type);
  return useMutation({
    mutationFn: ({ id, save }: { id: string; save: boolean }) =>
      save ? apiClient.saveToLibrary(PLURAL[type], id) : apiClient.removeFromLibrary(PLURAL[type], id),
    onMutate: async ({ id, save }) => {
      await qc.cancelQueries({ queryKey: idsKey });
      const prev = qc.getQueryData<string[]>(idsKey);
      qc.setQueryData<string[]>(idsKey, (old = []) =>
        save ? (old.includes(id) ? old : [...old, id]) : old.filter((x) => x !== id),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(idsKey, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.library.list(type) }),
  });
}

// ---------------------------------------------------------------- Likes

export function useMyLikes() {
  const uid = useUserId();
  return useInfiniteQuery({
    queryKey: qk.likes.list,
    queryFn: ({ pageParam }) => apiClient.listMyLikes({ page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: Boolean(uid),
  });
}

/** Which songs are liked — gives LikeButton a real initial state. */
export function useLikedIds() {
  const uid = useUserId();
  return useQuery({
    queryKey: qk.likes.ids,
    queryFn: async () => {
      const page = await apiClient.listMyLikes({ limit: IDS_LIMIT });
      return page.items.map((s) => s.id);
    },
    enabled: Boolean(uid),
    staleTime: 5 * 60_000,
  });
}

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ songId, like }: { songId: string; like: boolean }) =>
      like ? apiClient.likeSong(songId) : apiClient.unlikeSong(songId),
    onMutate: async ({ songId, like }) => {
      await qc.cancelQueries({ queryKey: qk.likes.ids });
      const prev = qc.getQueryData<string[]>(qk.likes.ids);
      qc.setQueryData<string[]>(qk.likes.ids, (old = []) =>
        like ? (old.includes(songId) ? old : [...old, songId]) : old.filter((x) => x !== songId),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.likes.ids, ctx.prev);
    },
    // Refresh the Liked songs list, but leave the ids cache as the source
    // of truth so the heart never flickers.
    onSettled: () => qc.invalidateQueries({ queryKey: qk.likes.list }),
  });
}

// --------------------------------------------------------------- Search

/** Small preview of every type — the Cmd+K palette's query, run on the debounced value. */
export function useQuickSearch(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: qk.search.quick(trimmed),
    queryFn: () => apiClient.quickSearch(trimmed),
    enabled: trimmed.length > 0,
    // A quick preview goes stale the instant the visible catalog changes
    // (a new like, a renamed playlist); no point caching it beyond the
    // keystroke that requested it.
    staleTime: 0,
  });
}

const SEARCH_FN = {
  songs: (q: string, page: number) => apiClient.searchSongs(q, { page, limit: PAGE_SIZE }),
  artists: (q: string, page: number) => apiClient.searchArtists(q, { page, limit: PAGE_SIZE }),
  albums: (q: string, page: number) => apiClient.searchAlbums(q, { page, limit: PAGE_SIZE }),
  playlists: (q: string, page: number) => apiClient.searchPlaylists(q, { page, limit: PAGE_SIZE }),
} as const;

/** Paginated results for one tab of the full `/search` page. */
export function useSearchResults(type: Exclude<SearchType, "all">, q: string) {
  const trimmed = q.trim();
  return useInfiniteQuery({
    queryKey: qk.search.typed(type, trimmed),
    // The four search endpoints differ only in their item shape, so the
    // union of their promise types can't satisfy a single `useInfiniteQuery`
    // overload. Every branch resolves to the same pagination envelope, which
    // is all this hook (and `flatItems`) needs.
    queryFn: ({ pageParam }): Promise<Paginated<unknown>> =>
      SEARCH_FN[type](trimmed, pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: trimmed.length > 0,
  });
}

/** Server-synced recent searches for signed-in users; guests use localStorage (see lib/recent-searches). */
export function useSearchHistory() {
  const uid = useUserId();
  return useQuery({
    queryKey: qk.search.history,
    queryFn: () => apiClient.listSearchHistory(),
    enabled: Boolean(uid),
  });
}

export function useRecordSearchHistory() {
  const qc = useQueryClient();
  const uid = useUserId();
  return useMutation({
    // Guests have no server-side history endpoint to call — the caller
    // still writes to localStorage itself either way (see
    // lib/recent-searches), this only covers the signed-in, cross-device copy.
    mutationFn: (query: string) => (uid ? apiClient.recordSearchHistory(query) : Promise.resolve()),
    onSuccess: () => {
      if (uid) qc.invalidateQueries({ queryKey: qk.search.history });
    },
  });
}

export function useClearSearchHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.clearSearchHistory(),
    onSuccess: () => qc.setQueryData(qk.search.history, []),
  });
}

// --------------------------------------------------------- Notifications

/**
 * The in-app notification inbox. `refetchInterval` is a deliberately slow
 * fallback (not the primary delivery mechanism) — real-time updates come
 * from useNotificationsSocket calling `invalidateQueries` on
 * qk.notifications.list/unreadCount the instant NotificationsGateway emits
 * "notification:new". This interval only protects against a missed/late
 * socket event (e.g. the tab was asleep when it fired) and network
 * blips, so it can stay long.
 */
export function useMyNotifications(enabled = true) {
  const uid = useUserId();
  return useInfiniteQuery({
    queryKey: qk.notifications.list(uid),
    queryFn: ({ pageParam }) => apiClient.getMyNotifications({ page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: enabled && Boolean(uid),
    refetchInterval: 2 * 60_000,
  });
}

/** Just the unread badge count — its own query so the bell icon doesn't need the full inbox list mounted. */
export function useUnreadNotificationCount() {
  const uid = useUserId();
  return useQuery({
    queryKey: qk.notifications.unreadCount(uid),
    queryFn: () => apiClient.getUnreadNotificationCount(),
    enabled: Boolean(uid),
    refetchInterval: 2 * 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const uid = useUserId();
  return useMutation({
    mutationFn: (id: string) => apiClient.markNotificationRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.notifications.list(uid) });
      const prevList = qc.getQueryData<InfiniteData<Paginated<Notification>>>(qk.notifications.list(uid));
      const prevCount = qc.getQueryData<number>(qk.notifications.unreadCount(uid));

      qc.setQueryData<InfiniteData<Paginated<Notification>>>(qk.notifications.list(uid), (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
              })),
            }
          : old,
      );
      qc.setQueryData<number>(qk.notifications.unreadCount(uid), (old) => (old ? Math.max(0, old - 1) : old));

      return { prevList, prevCount };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prevList) qc.setQueryData(qk.notifications.list(uid), ctx.prevList);
      if (ctx?.prevCount !== undefined) qc.setQueryData(qk.notifications.unreadCount(uid), ctx.prevCount);
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const uid = useUserId();
  return useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(),
    onSuccess: () => {
      qc.setQueryData(qk.notifications.unreadCount(uid), 0);
      qc.invalidateQueries({ queryKey: qk.notifications.list(uid) });
    },
  });
}

