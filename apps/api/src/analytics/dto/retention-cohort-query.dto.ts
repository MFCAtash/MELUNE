import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class RetentionCohortQueryDto {
  /**
   * Which rolling 7-day signup cohort to look at, counting back from
   * today: 0 = users who signed up in the trailing 7 days ending today,
   * 1 = the 7-day window before that, and so on. Capped at 51 (~1 year
   * back) for the same reason `AnalyticsRangeQueryDto.rangeDays` is
   * capped — bounding the query, not because anything else breaks past
   * that.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(51)
  weekOffset: number = 0;
}
