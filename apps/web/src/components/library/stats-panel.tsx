"use client";

import type { LucideIcon } from "lucide-react";
import { Heart, ListMusic, Play } from "lucide-react";
import { useMyStats } from "@/lib/queries";
import { formatCount } from "@/lib/format";
import { StatsPanelSkeleton } from "@/components/ui/skeleton";

function StatItem({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Icon size={16} />
      </span>
      <span>
        <span className="block text-lg font-semibold leading-tight text-foreground">{formatCount(value)}</span>
        <span className="block text-xs text-muted">{label}</span>
      </span>
    </div>
  );
}

/**
 * Likes / playlists / streams counts for the signed-in user. Supplementary
 * to the library page's tabs, so a failed fetch just hides the panel
 * instead of showing an error block over otherwise-working content.
 */
export function StatsPanel() {
  const { data, isLoading, isError } = useMyStats();

  if (isLoading) return <StatsPanelSkeleton />;
  if (isError || !data) return null;

  return (
    <div className="glass-panel flex items-center gap-6 rounded-2xl p-4">
      <StatItem label="Likes" value={data.likes} icon={Heart} />
      <StatItem label="Playlists" value={data.playlists} icon={ListMusic} />
      <StatItem label="Streams" value={data.plays} icon={Play} />
    </div>
  );
}
