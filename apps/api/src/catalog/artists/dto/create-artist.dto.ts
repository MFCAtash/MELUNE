import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateArtistDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  // Self-hosted platforms serve images from their own origin (e.g.
  // http://localhost:3000/covers/...) which validator.js's default IsUrl
  // (require_tld) rejects — accept any sane string instead.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;
}
