import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UploadLyricsDto {
  /** Raw `.lrc` file contents, sent as UTF-8 text (not multipart). */
  @IsString()
  @MinLength(1)
  @MaxLength(200_000)
  content: string;

  /** BCP-47-ish language hint: `fa`, `en`, `und` (undetermined). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;
}
