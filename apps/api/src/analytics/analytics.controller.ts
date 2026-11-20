import { Controller, Get, Query } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsRangeQueryDto } from "./dto/analytics-range-query.dto";
import { RetentionCohortQueryDto } from "./dto/retention-cohort-query.dto";

/**
 * Phase 11 — read-only admin analytics. Same enforcement as
 * AdminController: class-level `@Roles(Role.ADMIN)`, checked by the
 * global `RolesGuard` (see AuthModule). Kept as its own
 * module/controller rather than folded into AdminController: that one
 * is user/catalog-management CRUD, this one is purely aggregate reads
 * over listening data — keeping them apart means neither file becomes a
 * dumping ground for "everything admin".
 */
@Roles(Role.ADMIN)
@Controller("admin/analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("daily-active-users")
  dailyActiveUsers(@Query() query: AnalyticsRangeQueryDto) {
    return this.analytics.dailyActiveUsers(query.rangeDays);
  }

  @Get("top-genres")
  topGenresOverTime(@Query() query: AnalyticsRangeQueryDto) {
    return this.analytics.topGenresOverTime(query.rangeDays);
  }

  @Get("retention")
  retentionCohort(@Query() query: RetentionCohortQueryDto) {
    return this.analytics.retentionCohort(query.weekOffset);
  }
}
