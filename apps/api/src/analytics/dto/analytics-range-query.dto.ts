import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class AnalyticsRangeQueryDto {
  /**
   * Trailing window size in days, ending "now". Default 30. Capped at
   * 180 (not because a wider range is meaningless, but so this can't be
   * used to force an unbounded GROUP BY scan over `listening_history` —
   * same bounding rationale as `PaginationQueryDto.limit`'s cap of 100).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  rangeDays: number = 30;
}
