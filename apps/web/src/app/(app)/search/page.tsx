"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search as SearchIcon, X } from "lucide-react";
import type { SearchType, Song } from "@melune/types";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuthStore } from "@/store/auth-store";
import {
  flatItems,
  useClearSearchHistory,
  useRecordSearchHistory,
  useSearchHistory,
  useSearchResults,
} from "@/lib/queries";
import { addRecentSearch, clearRecentSearches, getRecentSearches } from "@/lib/recent-searches";
import { MediaCard, mediaGridClass } from "@/components/library/media-card";
import { TrackList } from "@/components/player/track-list";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ErrorIllustration,
  EmptySearchResultsIllustration,
  EmptySearchPromptIllustration,
} from "@/components/ui/empty-illustrations";
import { CardGridSkeleton, TrackRowsSkeleton } from "@/components/ui/skeleton";

type Tab = Exclude<SearchType, "all">;
const TABS: { id: Tab; label: string }[] = [
  { id: "songs", label: "Songs" },
  { id: "artists", label: "Artists" },
  { id: "albums", label: "Albums" },
  { id: "playlists", label: "Playlists" },
];

function LoadMore({
  hasNextPage,
  isFetching,
  onClick,
}: {
  hasNextPage: boolean;
  isFetching: boolean;
  onClick: () => void;
}) {
  if (!hasNextPage) return null;
  return (
    <button
      onClick={onClick}
      disabled={isFetching}
      className="mx-auto mt-6 block rounded-xl border border-border px-5 py-2 text-sm text-foreground hover:border-primary disabled:opacity-60"
    >
      {isFetching ? "Loading…" : "Load more"}
    </button>
  );
}

function RecentSearches({ query, onPick }: { query: string; onPick: (q: string) => void }) {
  const uid = useAuthStore((s) => s.user?.id ?? null);
  const serverHistory = useSearchHistory();
  const clearServerHistory = useClearSearchHistory();
  const [localRecent, setLocalRecent] = useState<string[]>([]);

  useEffect(() => setLocalRecent(getRecentSearches()), []);

  if (query.trim().length > 0) return null;

  const entries = uid ? (serverHistory.data ?? []).map((h) => h.query) : localRecent;
  if (entries.length === 0) return null;

  return (
    <section aria-label="Recent searches" className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">Recent searches</h2>
        <button
          onClick={() => {
            if (uid) clearServerHistory.mutate();
            else {
              clearRecentSearches();
              setLocalRecent([]);
            }
          }}
          className="text-xs text-muted hover:text-primary"
        >
          Clear
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {entries.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="rounded-full border border-border px-3.5 py-1.5 text-sm text-foreground hover:border-primary"
          >
            {q}
          </button>
        ))}
      </div>
    </section>
  );
}

function ResultsForTab({ tab, query }: { tab: Tab; query: string }) {
  const results = useSearchResults(tab, query);
  const items = flatItems(results.data);

  if (results.isLoading) {
    return tab === "songs" ? <TrackRowsSkeleton /> : <CardGridSkeleton />;
  }

  if (results.isError) {
    return (
      <EmptyState
        illustration={<ErrorIllustration />}
        title="Couldn't load results"
        description="Check your connection and try again."
        action={{ label: "Try again", onClick: () => results.refetch() }}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        illustration={<EmptySearchResultsIllustration />}
        title="No results"
        description={`Nothing matched "${query}" — try different keywords or check your spelling.`}
      />
    );
  }

  if (tab === "songs") {
    return (
      <div>
        <TrackList tracks={items as Song[]} showArtist />
        <LoadMore
          hasNextPage={results.hasNextPage}
          isFetching={results.isFetchingNextPage}
          onClick={() => results.fetchNextPage()}
        />
      </div>
    );
  }

  return (
    <div>
      <div className={mediaGridClass}>
        {items.map((item) => {
          if (tab === "artists") {
            const artist = item as { id: string; slug: string; name: string; imageUrl: string | null };
            return (
              <MediaCard
                key={artist.id}
                href={`/artist/${artist.slug}`}
                title={artist.name}
                coverUrl={artist.imageUrl}
                seed={artist.id}
                round
              />
            );
          }
          if (tab === "albums") {
            const album = item as {
              id: string;
              slug: string;
              title: string;
              coverUrl: string | null;
              artist: { name: string };
            };
            return (
              <MediaCard
                key={album.id}
                href={`/album/${album.slug}`}
                title={album.title}
                subtitle={album.artist.name}
                coverUrl={album.coverUrl}
                seed={album.id}
              />
            );
          }
          const playlist = item as {
            id: string;
            slug: string;
            title: string;
            coverUrl: string | null;
            owner?: { username: string };
          };
          return (
            <MediaCard
              key={playlist.id}
              href={`/playlist/${playlist.slug}`}
              title={playlist.title}
              subtitle={playlist.owner ? `By ${playlist.owner.username}` : "Public playlist"}
              coverUrl={playlist.coverUrl}
              seed={playlist.id}
            />
          );
        })}
      </div>
      <LoadMore
        hasNextPage={results.hasNextPage}
        isFetching={results.isFetchingNextPage}
        onClick={() => results.fetchNextPage()}
      />
    </div>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  // Initial tab can be deep-linked (`/search?type=albums`) — the Home
  // Discover menu's category chips use this to land on the right facet.
  const initialTab = searchParams.get("type");
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.id === initialTab) ? (initialTab as Tab) : "songs",
  );
  const debouncedQuery = useDebounce(query, 250);
  const recordHistory = useRecordSearchHistory();

  // Keep the URL in sync so a search is shareable/bookmarkable and survives a refresh.
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
    params.set("type", tab);
    router.replace(`/search?${params}`, { scroll: false });
  }, [debouncedQuery, tab, router]);

  function commitSearch(q: string) {
    if (!q.trim()) return;
    addRecentSearch(q);
    recordHistory.mutate(q);
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 py-6">
      <div className="relative">
        {/* Gradient focus ring: the input sits on a brand-gradient plate
            revealed as a glowing ring when focused. */}
        <div className="rounded-2xl bg-melune-gradient p-[1.5px] shadow-glow-sm transition-shadow focus-within:shadow-glow">
          <SearchIcon
            size={18}
            className="absolute start-4 top-1/2 z-10 -translate-y-1/2 text-muted"
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commitSearch(query)}
            placeholder="Search songs, artists, albums, playlists…"
            aria-label="Search"
            className="w-full rounded-[calc(1rem-1.5px)] border-0 bg-surface py-3.5 ps-11 pe-11 text-base text-foreground outline-none placeholder:text-muted/70 focus:bg-surfaceElevated"
          />
        </div>
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute end-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-surfaceElevated hover:text-foreground"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <RecentSearches query={debouncedQuery} onPick={setQuery} />

      {debouncedQuery.trim().length === 0 ? (
        <EmptyState
          illustration={<EmptySearchPromptIllustration />}
          title="Search your world of music"
          description="Look up songs, artists, albums or playlists by name."
        />
      ) : (
        <>
          <div role="tablist" aria-label="Result type" className="flex gap-1 border-b border-border">
            {TABS.map((tabDef) => (
              <button
                key={tabDef.id}
                role="tab"
                aria-selected={tab === tabDef.id}
                onClick={() => {
                  setTab(tabDef.id);
                  commitSearch(debouncedQuery);
                }}
                className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === tabDef.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {tabDef.label}
              </button>
            ))}
          </div>

          <ResultsForTab tab={tab} query={debouncedQuery} />
        </>
      )}
    </main>
  );
}

/**
 * useSearchParams() opts a page into client-side rendering; Next requires it
 * to sit under a Suspense boundary or `next build` fails while prerendering
 * this route ("missing-suspense-with-csr-bailout").
 */
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="py-10 text-center text-sm text-muted">Loading search…</div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
