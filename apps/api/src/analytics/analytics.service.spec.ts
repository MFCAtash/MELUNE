import { AnalyticsService } from "./analytics.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let prisma: {
    $queryRaw: jest.Mock;
    user: { findMany: jest.Mock };
    listeningHistory: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      user: { findMany: jest.fn() },
      listeningHistory: { findMany: jest.fn() },
    };
    service = new AnalyticsService(prisma as unknown as PrismaService);
  });

  describe("dailyActiveUsers", () => {
    it("converts raw bigint counts into numbers with ISO day strings", async () => {
      prisma.$queryRaw.mockResolvedValue([
        { day: new Date("2026-09-20T00:00:00Z"), count: 12n },
        { day: new Date("2026-09-21T00:00:00Z"), count: 7n },
      ]);

      const result = await service.dailyActiveUsers(30);

      expect(result.rangeDays).toBe(30);
      expect(result.series).toEqual([
        { date: "2026-09-20", count: 12 },
        { date: "2026-09-21", count: 7 },
      ]);
    });

    it("returns an empty series when there's no listening history in range", async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.dailyActiveUsers(7);

      expect(result.series).toEqual([]);
    });
  });

  describe("topGenresOverTime", () => {
    it('keeps only the top 5 genres by total plays and folds the rest into "other"', async () => {
      const day = new Date("2026-09-20T00:00:00Z");
      prisma.$queryRaw.mockResolvedValue([
        { day, genreId: "g1", genreName: "Pop", count: 100n },
        { day, genreId: "g2", genreName: "Rock", count: 90n },
        { day, genreId: "g3", genreName: "Jazz", count: 80n },
        { day, genreId: "g4", genreName: "Hip-Hop", count: 70n },
        { day, genreId: "g5", genreName: "Electronic", count: 60n },
        { day, genreId: "g6", genreName: "Folk", count: 5n },
      ]);

      const result = await service.topGenresOverTime(30);

      expect(result.genres.map((g) => g.id)).toEqual(["g1", "g2", "g3", "g4", "g5", "other"]);
      expect(result.series).toEqual([
        {
          date: "2026-09-20",
          counts: { g1: 100, g2: 90, g3: 80, g4: 70, g5: 60, other: 5 },
        },
      ]);
    });

    it('has no "other" bucket when there are 5 or fewer distinct genre keys', async () => {
      const day = new Date("2026-09-20T00:00:00Z");
      prisma.$queryRaw.mockResolvedValue([
        { day, genreId: "g1", genreName: "Pop", count: 10n },
        { day, genreId: null, genreName: null, count: 3n },
      ]);

      const result = await service.topGenresOverTime(30);

      expect(result.genres.map((g) => g.id)).toEqual(["g1", "unknown"]);
      expect(result.series[0].counts).toEqual({ g1: 10, unknown: 3 });
    });

    it("ranks genres by their plays summed across every day in range, not a single day's count", async () => {
      const day1 = new Date("2026-09-20T00:00:00Z");
      const day2 = new Date("2026-09-21T00:00:00Z");
      // g6 has a bigger single-day count (55) than g5's two-day sum
      // (31), but g5's *total* (31) still loses fairly to everyone
      // else's totals — the point is g6's total (55, in one row) is
      // correctly compared against sums like g2's 80 (40+40), not
      // against g2's larger single per-day row (40).
      prisma.$queryRaw.mockResolvedValue([
        { day: day1, genreId: "g1", genreName: "Pop", count: 100n },
        { day: day1, genreId: "g2", genreName: "Rock", count: 40n },
        { day: day2, genreId: "g2", genreName: "Rock", count: 40n }, // g2 total: 80
        { day: day1, genreId: "g3", genreName: "Jazz", count: 30n },
        { day: day2, genreId: "g3", genreName: "Jazz", count: 30n }, // g3 total: 60
        { day: day1, genreId: "g4", genreName: "Hip-Hop", count: 20n },
        { day: day2, genreId: "g4", genreName: "Hip-Hop", count: 20n }, // g4 total: 40
        { day: day1, genreId: "g5", genreName: "Electronic", count: 15n },
        { day: day2, genreId: "g5", genreName: "Electronic", count: 16n }, // g5 total: 31
        { day: day1, genreId: "g6", genreName: "Folk", count: 55n }, // g6 total: 55
      ]);

      const result = await service.topGenresOverTime(30);

      // By total: g1(100) > g2(80) > g6(55) > g3(60)? No — g3(60) > g6(55).
      // Correct total order: g1(100), g2(80), g3(60), g6(55), g4(40) — top 5.
      // g5(31), the smallest total, is the one folded into "other".
      expect(result.genres.map((g) => g.id)).toEqual(["g1", "g2", "g3", "g6", "g4", "other"]);
    });
  });

  describe("retentionCohort", () => {
    it("returns a null retentionRate (not 0) when the cohort week had no signups", async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.retentionCohort(2);

      expect(result.cohortSize).toBe(0);
      expect(result.returnedCount).toBe(0);
      expect(result.retentionRate).toBeNull();
      expect(prisma.listeningHistory.findMany).not.toHaveBeenCalled();
    });

    it("computes the fraction of the cohort seen again the following week", async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: "u1" },
        { id: "u2" },
        { id: "u3" },
        { id: "u4" },
      ]);
      prisma.listeningHistory.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);

      const result = await service.retentionCohort(3);

      expect(result.cohortSize).toBe(4);
      expect(result.returnedCount).toBe(2);
      expect(result.retentionRate).toBe(0.5);
      expect(prisma.listeningHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: { in: ["u1", "u2", "u3", "u4"] } }),
          distinct: ["userId"],
        }),
      );
    });

    it("marks the return week incomplete for the current cohort and complete for an old one", async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const current = await service.retentionCohort(0);
      const old = await service.retentionCohort(10);

      expect(current.isReturnWeekComplete).toBe(false);
      expect(old.isReturnWeekComplete).toBe(true);
    });
  });
});
