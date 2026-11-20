"use client";

import { Album, ListMusic, ListPlus, Mic2, Users } from "lucide-react";
import { GlassPanel, PanelHeader } from "@/components/ui/glass-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminStats } from "@/lib/admin-queries";
import { useTranslation } from "@/hooks/use-translation";
import type { TranslationKey } from "@/lib/i18n/translate";

const STAT_ICONS = {
  users: Users,
  artists: Mic2,
  songs: ListMusic,
  albums: Album,
  playlists: ListPlus,
} as const;

const STAT_LABEL_KEYS: Record<keyof typeof STAT_ICONS, TranslationKey> = {
  users: "admin.dashboard.statUsers",
  artists: "admin.dashboard.statArtists",
  songs: "admin.dashboard.statSongs",
  albums: "admin.dashboard.statAlbums",
  playlists: "admin.dashboard.statPlaylists",
};

export default function AdminDashboardPage() {
  const { data, isLoading } = useAdminStats();
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">{t("admin.dashboard.title")}</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(Object.keys(STAT_ICONS) as (keyof typeof STAT_ICONS)[]).map((key) => {
          const Icon = STAT_ICONS[key];
          return (
            <GlassPanel key={key} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted">{t(STAT_LABEL_KEYS[key])}</span>
                <Icon size={16} className="text-primary" />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-14" />
              ) : (
                <span className="text-2xl font-bold tabular-nums">
                  {data?.totals[key].toLocaleString("fa-IR")}
                </span>
              )}
            </GlassPanel>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel className="p-4">
          <PanelHeader title={t("admin.dashboard.last7Days")} />
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between border-b border-border pb-2">
                <span className="text-muted">{t("admin.dashboard.newUsers")}</span>
                <span className="font-semibold tabular-nums">
                  {data?.newUsersLast7Days.toLocaleString("fa-IR")}
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted">{t("admin.dashboard.plays")}</span>
                <span className="font-semibold tabular-nums">
                  {data?.playsLast7Days.toLocaleString("fa-IR")}
                </span>
              </li>
            </ul>
          )}

          {!isLoading && data && data.usersByDay.length > 0 && (
            <div
              className="mt-4 flex items-end gap-1.5"
              role="img"
              aria-label={t("admin.dashboard.signupTrendAria")}
            >
              {data.usersByDay.map((d) => {
                const max = Math.max(...data.usersByDay.map((x) => x.count), 1);
                return (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-codex-gradient"
                      style={{ height: `${Math.max((d.count / max) * 56, 4)}px` }}
                      title={`${d.date}: ${d.count}`}
                    />
                    <span className="text-[10px] text-muted">{d.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </GlassPanel>

        <GlassPanel className="p-4">
          <PanelHeader title={t("admin.dashboard.topSongs")} />
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : (
            <ol className="space-y-2.5 text-sm">
              {data?.topSongs.map((song, i) => (
                <li key={song.id} className="flex items-center gap-3">
                  <span className="w-4 text-muted tabular-nums">{i + 1}</span>
                  <span className="flex-1 truncate">{song.title}</span>
                  <span className="shrink-0 text-muted">{song.artist.name}</span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {song.playCount.toLocaleString("fa-IR")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
