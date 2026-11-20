import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateAlbumDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title: string;

  // Self-hosted platforms serve covers from their own origin (e.g.
  // http://localhost:3000/covers/...) which validator.js's default IsUrl
  // (require_tld) rejects — accept any sane string instead.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverUrl?: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  // Admin-only: create an album under an arbitrary artist. Ignored for
  // @Roles(ARTIST) callers, who always create under their own profile.
  @IsOptional()
  @IsString()
  artistId?: string;
}
