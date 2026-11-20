"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Music,
  Mic2,
  Disc3,
  ListMusic,
  X,
  Clock,
  Home,
  Library,
  ListPlus,
  Moon,
  Sun,
  LogOut,
  LogIn,
  Command,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { PlaylistSummary, SearchAlbum, SearchArtist, Song } from "@codex-music/types";
import { useDebounce } from "@/hooks/use-debounce";
import { useTranslation } from "@/hooks/use-translation";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { usePlayerStore } from "@/store/player-store";
import { useUiStore } from "@/store/ui-store";
import { useThemeStore } from "@/store/theme-store";
import { useQuickSearch, useRecordSearchHistory, useSearchHistory } from "@/lib/queries";
import { addRecentSearch, getRecentSearches } from "@/lib/recent-searches";
import { Cover } from "@/components/ui/cover";

type ResultItem =
  | { kind: "song"; data: Song }
  | { kind: "artist"; data: SearchArtist }
  | { kind: "album"; data: SearchAlbum }
  | { kind: "playlist"; data: PlaylistSummary };

/** A navigable/runnable command — Home/Search/Library, theme toggle, sign out, etc. */
interface ActionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  run: () => void;
}

/** One selectable row — used for both mouse and keyboard (↑/↓ + Enter) selection. */
function Row({
  active,
  onSelect,
  onHover,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <li>
      <button
        onClick={onSelect}
        onMouseEnter={onHover}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start ${
          active ? "bg-surfaceElevated" : "hover:bg-surfaceElevated/60"
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm text-foreground">{title}</span>
          {subtitle && <span className="block truncate text-xs text-muted">{subtitle}</span>}
        </span>
      </button>
    </li>
  );
}

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const close = useUiStore((s) => s.closeCommandPalette);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const uid = useAuthStore((s) => s.user?.id ?? null);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 250ms — fast enough to feel live, slow enough that a normal typing
  // burst produces one request instead of one per keystroke.
  const debouncedQuery = useDebounce(query, 250);
  const results = useQuickSearch(debouncedQuery);
  const recordHistory = useRecordSearchHistory();
  const serverHistory = useSearchHistory();

  const [localRecent, setLocalRecent] = useState<string[]>([]);
  useEffect(() => {
    if (open) setLocalRecent(getRecentSearches());
  }, [open]);

  const recentQueries = uid ? (serverHistory.data ?? []).map((h) => h.query) : localRecent;

  async function logout() {
    close();
    await apiClient.logout().catch(() => undefined);
    usePlayerStore.getState().pause();
    useAuthStore.getState().clear();
    queryClient.clear();
    router.replace("/login");
  }

  // Global commands, not just catalog search (Phase 6.7) — navigation,
  // theme, and session actions all live here so ⌘K works the way it
  // does in most desktop apps, not just as a search box.
  const actionItems: ActionItem[] = useMemo(() => {
    const goHome = () => {
      close();
      router.push("/home");
    };
    const goSearch = () => {
      close();
      router.push("/search");
    };
    const goLibrary = () => {
      close();
      router.push("/library");
    };
    const createPlaylist = () => {
      close();
      useUiStore.getState().openCreatePlaylist();
    };
    const goLogin = () => {
      close();
      router.push("/login");
    };

    const items: ActionItem[] = [
      { id: "go-home", label: t("nav.home"), icon: <Home size={16} />, run: goHome },
      { id: "go-search", label: t("nav.search"), icon: <Search size={16} />, run: goSearch },
      { id: "go-library", label: t("nav.yourLibrary"), icon: <Library size={16} />, run: goLibrary },
    ];
    if (uid) {
      items.push({
        id: "create-playlist",
        label: "New playlist",
        icon: <ListPlus size={16} />,
        run: createPlaylist,
      });
    }
    items.push({
      id: "toggle-theme",
      label: theme === "dark" ? t("common.themeLight") : t("common.themeDark"),
      icon: theme === "dark" ? <Sun size={16} /> : <Moon size={16} />,
      run: toggleTheme,
    });
    items.push(
      uid
        ? { id: "logout", label: t("nav.logOut"), icon: <LogOut size={16} />, run: logout }
        : { id: "login", label: t("nav.logIn"), icon: <LogIn size={16} />, run: goLogin },
    );
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, theme, t]);

  // Reset on open/close so a stale query and scroll position never carry over.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);
  useEffect(() => setActiveIndex(0), [debouncedQuery]);

  const items: ResultItem[] = useMemo(() => {
    if (!results.data) return [];
    return [
      ...results.data.songs.map((data): ResultItem => ({ kind: "song", data })),
      ...results.data.artists.map((data): ResultItem => ({ kind: "artist", data })),
      ...results.data.albums.map((data): ResultItem => ({ kind: "album", data })),
      ...results.data.playlists.map((data): ResultItem => ({ kind: "playlist", data })),
    ];
  }, [results.data]);

  const showingResults = debouncedQuery.trim().length > 0;
  const hasResults = items.length > 0;
  // While typing, actions are filtered by label so "theme" or "log out"
  // surfaces the matching command right alongside catalog matches.
  const matchingActions = showingResults
    ? actionItems.filter((a) => a.label.toLowerCase().includes(debouncedQuery.trim().toLowerCase()))
    : actionItems;

  function commit(q: string) {
    addRecentSearch(q);
    recordHistory.mutate(q);
  }

  function selectItem(item: ResultItem) {
    commit(query);
    close();
    if (item.kind === "song") {
      usePlayerStore.getState().playQueue([item.data], 0);
      return;
    }
    const href =
      item.kind === "artist"
        ? `/artist/${item.data.slug}`
        : item.kind === "album"
          ? `/album/${item.data.slug}`
          : `/playlist/${item.data.slug}`;
    router.push(href);
  }

  function viewAll() {
    commit(query);
    close();
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function runRecent(q: string) {
    setQuery(q);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const selectable = showingResults
      ? items.length + matchingActions.length + (hasResults ? 1 : 0)
      : recentQueries.length + actionItems.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(selectable - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showingResults) {
        if (activeIndex < items.length) {
          selectItem(items[activeIndex]);
        } else if (activeIndex < items.length + matchingActions.length) {
          matchingActions[activeIndex - items.length].run();
        } else if (hasResults && activeIndex === items.length + matchingActions.length) {
          viewAll();
        } else if (query.trim()) {
          viewAll();
        }
      } else if (activeIndex < recentQueries.length) {
        runRecent(recentQueries[activeIndex]);
      } else if (actionItems[activeIndex - recentQueries.length]) {
        actionItems[activeIndex - recentQueries.length].run();
      }
    }
  }

  if (!open) return null;

  const groups: { icon: React.ReactNode; label: string; entries: ResultItem[] }[] = [
    {
      icon: <Music size={16} className="text-muted" />,
      label: t("search.songs"),
      entries: items.filter((i) => i.kind === "song"),
    },
    {
      icon: <Mic2 size={16} className="text-muted" />,
      label: t("search.artists"),
      entries: items.filter((i) => i.kind === "artist"),
    },
    {
      icon: <Disc3 size={16} className="text-muted" />,
      label: t("search.albums"),
      entries: items.filter((i) => i.kind === "album"),
    },
    {
      icon: <ListMusic size={16} className="text-muted" />,
      label: t("search.playlists"),
      entries: items.filter((i) => i.kind === "playlist"),
    },
  ].filter((g) => g.entries.length > 0);

  let rowCursor = -1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("search.placeholder")}
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
      onClick={close}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("search.placeholder")}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted/70"
          />
          <button
            onClick={close}
            aria-label={t("common.close")}
            className="shrink-0 rounded-full p-1 text-muted hover:bg-surfaceElevated hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {!showingResults && (
            <div>
              {recentQueries.length > 0 && (
                <>
                  <p className="px-3 py-1.5 text-xs font-medium text-muted">{t("search.recent")}</p>
                  <ul>
                    {recentQueries.map((q, i) => {
                      rowCursor += 1;
                      const idx = rowCursor;
                      return (
                        <Row
                          key={q}
                          active={idx === activeIndex}
                          onHover={() => setActiveIndex(idx)}
                          onSelect={() => runRecent(q)}
                          icon={<Clock size={16} className="text-muted" />}
                          title={q}
                        />
                      );
                    })}
                  </ul>
                </>
              )}

              <p className="px-3 py-1.5 text-xs font-medium text-muted">Quick actions</p>
              <ul>
                {actionItems.map((action) => {
                  rowCursor += 1;
                  const idx = rowCursor;
                  return (
                    <Row
                      key={action.id}
                      active={idx === activeIndex}
                      onHover={() => setActiveIndex(idx)}
                      onSelect={action.run}
                      icon={action.icon}
                      title={action.label}
                    />
                  );
                })}
              </ul>
            </div>
          )}

          {showingResults && results.isLoading && (
            <p className="px-3 py-8 text-center text-sm text-muted">{t("common.loading")}…</p>
          )}

          {showingResults && !results.isLoading && !hasResults && matchingActions.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-sm text-foreground">{t("search.noResults")}</p>
              <p className="mt-1 text-xs text-muted">{t("search.noResultsHint")}</p>
            </div>
          )}

          {showingResults &&
            hasResults &&
            groups.map((group) => (
              <div key={group.label} className="mb-2">
                <p className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted">
                  {group.icon}
                  {group.label}
                </p>
                <ul>
                  {group.entries.map((item) => {
                    rowCursor += 1;
                    const idx = rowCursor;
                    const key = `${item.kind}-${item.data.id}`;
                    if (item.kind === "song") {
                      return (
                        <Row
                          key={key}
                          active={idx === activeIndex}
                          onHover={() => setActiveIndex(idx)}
                          onSelect={() => selectItem(item)}
                          icon={<Cover title={item.data.title} url={item.data.coverUrl} className="h-full w-full text-sm" />}
                          title={item.data.title}
                          subtitle={item.data.artist.name}
                        />
                      );
                    }
                    if (item.kind === "artist") {
                      return (
                        <Row
                          key={key}
                          active={idx === activeIndex}
                          onHover={() => setActiveIndex(idx)}
                          onSelect={() => selectItem(item)}
                          icon={
                            <Cover
                              title={item.data.name}
                              url={item.data.imageUrl}
                              className="h-full w-full rounded-full text-sm"
                            />
                          }
                          title={item.data.name}
                        />
                      );
                    }
                    if (item.kind === "album") {
                      return (
                        <Row
                          key={key}
                          active={idx === activeIndex}
                          onHover={() => setActiveIndex(idx)}
                          onSelect={() => selectItem(item)}
                          icon={<Cover title={item.data.title} url={item.data.coverUrl} className="h-full w-full text-sm" />}
                          title={item.data.title}
                          subtitle={item.data.artist.name}
                        />
                      );
                    }
                    return (
                      <Row
                        key={key}
                        active={idx === activeIndex}
                        onHover={() => setActiveIndex(idx)}
                        onSelect={() => selectItem(item)}
                        icon={<Cover title={item.data.title} url={item.data.coverUrl} className="h-full w-full text-sm" />}
                        title={item.data.title}
                        subtitle={item.data.owner ? `${item.data.owner.username}` : undefined}
                      />
                    );
                  })}
                </ul>
              </div>
            ))}

          {showingResults && matchingActions.length > 0 && (
            <div className="mb-2">
              <p className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted">
                <Command size={13} />
                Actions
              </p>
              <ul>
                {matchingActions.map((action) => {
                  rowCursor += 1;
                  const idx = rowCursor;
                  return (
                    <Row
                      key={action.id}
                      active={idx === activeIndex}
                      onHover={() => setActiveIndex(idx)}
                      onSelect={action.run}
                      icon={action.icon}
                      title={action.label}
                    />
                  );
                })}
              </ul>
            </div>
          )}

          {showingResults && hasResults && (
            <button
              onClick={viewAll}
              onMouseEnter={() => setActiveIndex(items.length + matchingActions.length)}
              className={`mt-1 block w-full rounded-lg px-3 py-2.5 text-start text-sm text-primary ${
                activeIndex === items.length + matchingActions.length
                  ? "bg-surfaceElevated"
                  : "hover:bg-surfaceElevated/60"
              }`}
            >
              {t("search.viewAllResultsFor", { query })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
