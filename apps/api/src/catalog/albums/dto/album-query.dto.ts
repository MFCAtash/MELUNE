import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class AlbumQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  artistId?: string;
}
