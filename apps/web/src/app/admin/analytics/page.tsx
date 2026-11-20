"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GlassPanel, PanelHeader } from "@/components/ui/glass-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/use-translation";
import {
  useAdminDailyActiveUsers,
  useAdminRetentionCohort,
  useAdminTopGenresOverTime,
} from "@/lib/admin-queries";

/**
 * Phase 11 — admin analytics page. Distinct from the dashboard's
 * `usersByDay` mini-chart (`/admin`, fixed 7-day window, no controls):
 * this page has its own caller-chosen range/cohort per chart and reads
 * from `/admin/analytics/*`, not `/admin/stats`.
 *
 * No chart library here on purpose — same choice the dashboard's
 * `usersByDay` bars already made (plain divs sized by percentage, no
 * recharts/chart.js dependency). This page extends that same
 * hand-rolled approach: an inline SVG polyline for the line chart, and
 * stacked divs for the bar chart, rather than introducing a new
 * charting dependency for two more charts.
 */

const RANGE_OPTIONS = [7, 30, 90] as const;

// Same hex values as the "extended palette" genre-chip colors in
// tailwind.config.ts (teal/rose/amber/indigo/magenta) — reused here
// verbatim rather than inventing a second color story for genres.
const GENRE_COLORS = ["#14B8A6", "#F43F5E", "#F59E0B", "#6366F1", "#D946EF"];
const OTHER_COLOR = "#6B7280"; // neutral gray — matches --color-muted's ballpark, not brand-colored on purpose

export default function AdminAnalyticsPage() {
  const { t } = useTranslation();
  const [rangeDays, setRangeDays] = useState<(typeof RANGE_OPTIONS)[number]>(30);
  const [weekOffset, setWeekOffset] = useState(1); // default to the most recent *complete* cohort week, not the in-progress one (0)

  const dau = useAdminDailyActiveUsers(rangeDays);
  const genres = useAdminTopGenresOverTime(rangeDays);
  const retention = useAdminRetentionCohort(weekOffset);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("admin.analytics.title")}</h1>

        <div className="flex gap-1 rounded-full bg-surfaceElevated p-1">
          {RANGE_OPTIONS.map((days) => (
            <button
              key={days}
              onClick={() => setRangeDays(days)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                rangeDays === days ? "bg-melune-gradient text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {t("admin.analytics.rangeDaysLabel", { count: days.toLocaleString("fa-IR") })}
            </button>
          ))}
        </div>
      </div>

      <GlassPanel className="p-4">
        <PanelHeader title={t("admin.analytics.dauTitle")} />
        <DailyActiveUsersChart
          isLoading={dau.isLoading}
          series={dau.data?.series}
        />
      </GlassPanel>

      <GlassPanel className="p-4">
        <PanelHeader title={t("admin.analytics.topGenresTitle")} />
        <TopGenresChart
          isLoading={genres.isLoading}
          genres={genres.data?.genres}
          series={genres.data?.series}
        />
      </GlassPanel>

      <GlassPanel className="p-4">
        <PanelHeader
          title={t("admin.analytics.retentionTitle")}
          action={
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekOffset((w) => Math.min(w + 1, 51))}
                className="rounded-full p-1.5 text-muted hover:bg-surfaceElevated hover:text-foreground"
                aria-label={t("admin.analytics.olderWeek")}
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setWeekOffset((w) => Math.max(w - 1, 0))}
                className="rounded-full p-1.5 text-muted hover:bg-surfaceElevated hover:text-foreground disabled:opacity-30"
                aria-label={t("admin.analytics.newerWeek")}
                disabled={weekOffset === 0}
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          }
        />
        <RetentionCohortPanel isLoading={retention.isLoading} data={retention.data} />
      </GlassPanel>
    </div>
  );
}

// ------------------------------------------------------- DAU line chart

function DailyActiveUsersChart({
  isLoading,
  series,
}: {
  isLoading: boolean;
  series?: { date: string; count: number }[];
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!series || series.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{t("admin.analytics.noData")}</p>;
  }

  const width = 700;
  const height = 160;
  const max = Math.max(...series.map((d) => d.count), 1);
  const stepX = series.length > 1 ? width / (series.length - 1) : 0;

  const points = series.map((d, i) => {
    const x = series.length > 1 ? i * stepX : width / 2;
    const y = height - (d.count / max) * (height - 8) - 4;
    return { x, y, date: d.date, count: d.count };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full"
        role="img"
        aria-label={t("admin.analytics.dauChartAria")}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="dauFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#dauFill)" stroke="none" />
        <path d={linePath} fill="none" stroke="#8B5CF6" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {points.map((p) => (
          <circle key={p.date} cx={p.x} cy={p.y} r={2.5} fill="#3B82F6">
            <title>{`${p.date}: ${p.count.toLocaleString("fa-IR")}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{points[0].date.slice(5)}</span>
        <span>{points[points.length - 1].date.slice(5)}</span>
      </div>
    </div>
  );
}

// --------------------------------------------------- Genre stacked bars

function TopGenresChart({
  isLoading,
  genres,
  series,
}: {
  isLoading: boolean;
  genres?: { id: string; name: string }[];
  series?: { date: string; counts: Record<string, number> }[];
}) {
  const { t } = useTranslation();

  const colorByGenre = useMemo(() => {
    const map = new Map<string, string>();
    genres?.forEach((g, i) => {
      map.set(g.id, g.id === "other" ? OTHER_COLOR : GENRE_COLORS[i % GENRE_COLORS.length]);
    });
    return map;
  }, [genres]);

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!genres || !series || series.length === 0 || genres.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{t("admin.analytics.noData")}</p>;
  }

  const dayTotals = series.map((d) => Object.values(d.counts).reduce((a, b) => a + b, 0));
  const max = Math.max(...dayTotals, 1);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3">
        {genres.map((g) => (
          <span key={g.id} className="flex items-center gap-1.5 text-xs text-muted">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colorByGenre.get(g.id) }}
            />
            {g.name}
          </span>
        ))}
      </div>

      <div className="flex h-40 items-end gap-1" role="img" aria-label={t("admin.analytics.genreChartAria")}>
        {series.map((d) => {
          const total = Object.values(d.counts).reduce((a, b) => a + b, 0);
          const barHeight = Math.max((total / max) * 100, total > 0 ? 2 : 0);
          return (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="flex w-full flex-col-reverse overflow-hidden rounded-t"
                style={{ height: `${barHeight}%` }}
                title={`${d.date}: ${total.toLocaleString("fa-IR")}`}
              >
                {genres.map((g) => {
                  const count = d.counts[g.id] ?? 0;
                  if (count === 0 || total === 0) return null;
                  return (
                    <div
                      key={g.id}
                      style={{
                        height: `${(count / total) * 100}%`,
                        backgroundColor: colorByGenre.get(g.id),
                      }}
                    />
                  );
                })}
              </div>
              <span className="text-[10px] text-muted">{d.date.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------ Retention panel

function RetentionCohortPanel({
  isLoading,
  data,
}: {
  isLoading: boolean;
  data?: {
    weekOffset: number;
    cohortWeekStart: string;
    cohortWeekEnd: string;
    isReturnWeekComplete: boolean;
    cohortSize: number;
    returnedCount: number;
    retentionRate: number | null;
  };
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-7 w-24" />
      </div>
    );
  }

  if (!data) return null;

  const cohortStart = data.cohortWeekStart.slice(0, 10);
  const cohortEnd = data.cohortWeekEnd.slice(0, 10);

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">{t("admin.analytics.cohortRange", { start: cohortStart, end: cohortEnd })}</p>

      {data.cohortSize === 0 ? (
        <p className="text-muted">{t("admin.analytics.noSignups")}</p>
      ) : (
        <>
          <div className="flex items-end gap-6">
            <div>
              <div className="text-xs text-muted">{t("admin.analytics.cohortSize")}</div>
              <div className="text-2xl font-bold tabular-nums">
                {data.cohortSize.toLocaleString("fa-IR")}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted">{t("admin.analytics.returnedCount")}</div>
              <div className="text-2xl font-bold tabular-nums">
                {data.returnedCount.toLocaleString("fa-IR")}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted">{t("admin.analytics.retentionRate")}</div>
              <div className="text-2xl font-bold tabular-nums text-primary">
                {data.retentionRate === null
                  ? "—"
                  : `${(data.retentionRate * 100).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`}
              </div>
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-surfaceElevated">
            <div
              className="h-full bg-melune-gradient"
              style={{ width: `${(data.retentionRate ?? 0) * 100}%` }}
            />
          </div>
        </>
      )}

      {!data.isReturnWeekComplete && (
        <p className="text-xs text-amber">{t("admin.analytics.returnWeekIncomplete")}</p>
      )}
    </div>
  );
}
