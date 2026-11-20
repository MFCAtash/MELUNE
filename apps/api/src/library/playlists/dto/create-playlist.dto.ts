import { IsBoolean, IsHexColor, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

export class CreatePlaylistDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  /** Hex color from the brand swatch picker, e.g. "#8B5CF6". Omit/null to
   *  fall back to the deterministic per-id palette on the client — `null`
   *  is how the "Auto" swatch clears a previously-set color on update. */
  @IsOptional()
  @IsHexColor()
  accentColor?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
