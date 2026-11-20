import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class SongQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  artistId?: string;

  @IsOptional()
  @IsString()
  albumId?: string;

  @IsOptional()
  @IsString()
  genreId?: string;
}
