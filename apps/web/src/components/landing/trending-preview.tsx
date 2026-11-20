"use client";

import { useHomeFeed } from "@/lib/queries";
import { SongShelf } from "@/components/home/song-shelf";
import { ShelfSkeleton } from "@/components/ui/skeleton";

/** Playable trending shelf for guests — the product, not a screenshot of it. */
export function TrendingPreview() {
  const { data, isLoading, isError } = useHomeFeed();
  if (isError) return null;
  if (isLoading) return <ShelfSkeleton />;
  if (!data || data.trending.length === 0) return null;
  return <SongShelf title="Trending now" songs={data.trending} />;
}
