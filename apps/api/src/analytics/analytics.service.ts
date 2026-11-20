import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const TOP_GENRE_COUNT = 5;

interface DailyActiveRow {
  day: Date;
  count: bigint;
}

interface GenreDayRow {
  day: Date;
  genreId: string | null;
  genreName: string | null;
  count: bigint;
}

export interface DailyActiveUsersResult {
  rangeDays: number;
  since: string;
  series: { date: string; count: number }[];
}

export interface TopGenresOverTimeResult {
  rangeDays: number;
  since: string;
  /** The (at most `TOP_GENRE_COUNT` + 1) series keys that appear in
   *  every `series[n].counts` object, in a stable, chart-legend-ready
   *  order. The synthetic "other" bucket (id `"other"`) is only present
   *  when at least one genre didn't make the top N. */
  genres: { id: string; name: string }[];
  series: { date: string; counts: Record<string, number> }[];
}

export interface RetentionCohortResult {
  weekOffset: number;
  cohortWeekStart: string;
  cohortWeekEnd: string;
  returnWeekStart: string;
  returnWeekEnd: string;
  /** False when `returnWeekEnd` hasn't happened yet (e.g. weekOffset 0,
   *  "this week" isn't over) — the rate below is provisional until this
   *  is true, since more of the cohort could still come back. */
  isReturnWeekComplete: boolean;
  cohortSize: number;
  returnedCount: number;
  /** null (not 0) when the cohort itself is empty — "nobody came back"
   *  and "nobody signed up to measure" are different facts, and
   *  collapsing them into the same 0% would be misleading in a chart. */
  retentionRate: number | null;
}

/**
 * Phase 11 — read-only admin analytics.
 *
 * Deliberately built as aggregate queries over data that already exists
 * (`ListeningHistory`, `User`, `Song`, `Genre`) rather than a new
 * `PlayEvent` model: `ListeningHistory` already has exactly one row per
 * play with the fields these queries need (`userId`, `songId`,
 * `playedAt`) — a separate event table would just be a second copy of
 * the same fact under a different name, with its own write path to keep
 * in sync. Nothing in this service writes anything; it only reads.
 *
 * All three queries reuse the same "rolling window ending now" framing
 * `AdminService.getStats()` already uses for its 7-day numbers (see
 * `SEVEN_DAYS_MS` there), rather than introducing calendar-week/month
 * bucketing as a second, inconsistent convention alongside it.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Distinct listeners per calendar day (UTC), for the trailing `rangeDays`. */
  async dailyActiveUsers(rangeDays: number): Promise<DailyActiveUsersResult> {
    const since = new Date(Date.now() - rangeDays * DAY_MS);

    // date_trunc groups by calendar day in UTC — same helper Prisma has
    // no query-builder equivalent for, same rationale as the raw
    // `usersByDay` query in AdminService.getStats.
    const rows = await this.prisma.$queryRaw<DailyActiveRow[]>`
      SELECT date_trunc('day', "playedAt") AS day, COUNT(DISTINCT "userId")::bigint AS count
      FROM listening_history
      WHERE "playedAt" >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `;

    return {
      rangeDays,
      since: since.toISOString(),
      series: rows.map((row) => ({
        date: row.day.toISOString().slice(0, 10),
        count: Number(row.count),
      })),
    };
  }

  /**
   * Per-day play counts broken down by genre, restricted to the top
   * `TOP_GENRE_COUNT` genres by total plays across the whole range —
   * everything else (including untagged songs) collapses into a
   * synthetic "سایر" ("other") bucket, so a catalog with dozens of
   * genres doesn't produce one unreadable line per genre.
   */
  async topGenresOverTime(rangeDays: number): Promise<TopGenresOverTimeResult> {
    const since = new Date(Date.now() - rangeDays * DAY_MS);

    const rows = await this.prisma.$queryRaw<GenreDayRow[]>`
      SELECT
        date_trunc('day', lh."playedAt") AS day,
        g.id AS "genreId",
        g.name AS "genreName",
        COUNT(*)::bigint AS count
      FROM listening_history lh
      JOIN songs s ON s.id = lh."songId"
      LEFT JOIN genres g ON g.id = s."genreId"
      WHERE lh."playedAt" >= ${since}
      GROUP BY day, g.id, g.name
      ORDER BY day ASC
    `;

    // Rank by total plays across the whole range, not by any single
    // day — a genre that spikes once but is otherwise tiny shouldn't
    // bump a consistently-mid genre out of its own series.
    const totalsByGenre = new Map<string, { name: string; total: number }>();
    for (const row of rows) {
      const key = row.genreId ?? "unknown";
      const name = row.genreName ?? "بدون ژانر";
      const count = Number(row.count);
      const existing = totalsByGenre.get(key);
      if (existing) {
        existing.total += count;
      } else {
        totalsByGenre.set(key, { name, total: count });
      }
    }

    const topGenreIds = [...totalsByGenre.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, TOP_GENRE_COUNT)
      .map(([id]) => id);
    const topGenreSet = new Set(topGenreIds);

    const genres = topGenreIds.map((id) => ({ id, name: totalsByGenre.get(id)!.name }));
    const hasOther = [...totalsByGenre.keys()].some((id) => !topGenreSet.has(id));
    if (hasOther) genres.push({ id: "other", name: "سایر" });

    const byDate = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const date = row.day.toISOString().slice(0, 10);
      const rawKey = row.genreId ?? "unknown";
      const key = topGenreSet.has(rawKey) ? rawKey : "other";
      if (!byDate.has(date)) byDate.set(date, new Map());
      const dayMap = byDate.get(date)!;
      dayMap.set(key, (dayMap.get(key) ?? 0) + Number(row.count));
    }

    const series = [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, counts]) => ({
        date,
        counts: Object.fromEntries(genres.map((g) => [g.id, counts.get(g.id) ?? 0])),
      }));

    return { rangeDays, since: since.toISOString(), genres, series };
  }

  /**
   * Week-over-week retention: of the users who registered during the
   * rolling 7-day cohort window `weekOffset` weeks back, what fraction
   * were seen (via `ListeningHistory`) during the following 7-day
   * window?
   *
   * "Week" here is a rolling 7-day bucket anchored to the start of
   * today (UTC) — `weekOffset=0` is "signed up in the last 7 days,
   * came back at all since" (necessarily incomplete, see
   * `isReturnWeekComplete`), `weekOffset=1` is the cohort from 7–14
   * days ago and whether they returned in days 0–7, and so on. This
   * matches the rolling-window convention `dailyActiveUsers` and
   * `AdminService.getStats` already use, rather than introducing
   * calendar (Mon–Sun) weeks as a second, inconsistent definition.
   */
  async retentionCohort(weekOffset: number): Promise<RetentionCohortResult> {
    const today0 = startOfUtcDay(new Date());
    const cohortWeekEnd = new Date(today0.getTime() - weekOffset * WEEK_MS);
    const cohortWeekStart = new Date(cohortWeekEnd.getTime() - WEEK_MS);
    const returnWeekStart = cohortWeekEnd;
    const returnWeekEnd = new Date(cohortWeekEnd.getTime() + WEEK_MS);

    const cohortUsers = await this.prisma.user.findMany({
      where: {
        createdAt: { gte: cohortWeekStart, lt: cohortWeekEnd },
        deletedAt: null,
      },
      select: { id: true },
    });

    const cohortSize = cohortUsers.length;
    let returnedCount = 0;

    // Skip the second query entirely for an empty cohort — an `IN ()`
    // with no ids would either error or need special-casing anyway, and
    // there's nothing to measure.
    if (cohortSize > 0) {
      const returned = await this.prisma.listeningHistory.findMany({
        where: {
          userId: { in: cohortUsers.map((u) => u.id) },
          playedAt: { gte: returnWeekStart, lt: returnWeekEnd },
        },
        select: { userId: true },
        distinct: ["userId"],
      });
      returnedCount = returned.length;
    }

    return {
      weekOffset,
      cohortWeekStart: cohortWeekStart.toISOString(),
      cohortWeekEnd: cohortWeekEnd.toISOString(),
      returnWeekStart: returnWeekStart.toISOString(),
      returnWeekEnd: returnWeekEnd.toISOString(),
      isReturnWeekComplete: returnWeekEnd.getTime() <= Date.now(),
      cohortSize,
      returnedCount,
      retentionRate: cohortSize > 0 ? returnedCount / cohortSize : null,
    };
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
