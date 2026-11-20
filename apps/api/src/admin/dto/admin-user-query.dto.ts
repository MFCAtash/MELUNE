import { IsBooleanString, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class AdminUserQueryDto extends PaginationQueryDto {
  /** Matches against email or username, case-insensitive substring. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(["USER", "ARTIST", "ADMIN"])
  role?: "USER" | "ARTIST" | "ADMIN";

  /** "true" to include banned (soft-deleted) accounts, "false" for active-only (default). */
  @IsOptional()
  @IsBooleanString()
  includeBanned?: string;
}
