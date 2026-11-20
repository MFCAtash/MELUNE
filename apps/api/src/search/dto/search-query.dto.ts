import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export const SEARCH_TYPES = ["all", "songs", "artists", "albums", "playlists"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export class SearchQueryDto extends PaginationQueryDto {
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(1)
  @MaxLength(100)
  q: string;

  // `all` ignores page/limit and returns a small, fixed-size preview per
  // group — it's what the Cmd+K palette calls. A single specific type
  // returns a normally paginated list — what the /search page's tabs call.
  @IsOptional()
  @IsIn(SEARCH_TYPES)
  type: SearchType = "all";
}
