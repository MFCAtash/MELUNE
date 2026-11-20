import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  Max,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateSongDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title: string;

  @IsOptional()
  @IsString()
  albumId?: string;

  @IsOptional()
  @IsString()
  genreId?: string;

  @IsInt()
  @Min(1)
  duration: number; // seconds

  @IsUrl()
  audioUrl: string;

  // Self-hosted platforms serve covers from their own origin (e.g.
  // http://localhost:3000/covers/...) which validator.js's default IsUrl
  // (require_tld) rejects — accept any sane string instead.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverUrl?: string;

  // ---- Phase 8.2 content-features, for the recommendation engine ----
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(300)
  bpm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  mood?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  energy?: number;

  // ---- Admin-only: create a song under an arbitrary artist ----
  // Ignored for @Roles(ARTIST) callers, who always create under their
  // own artist profile — see SongsController.create.
  @IsOptional()
  @IsString()
  artistId?: string;
}
