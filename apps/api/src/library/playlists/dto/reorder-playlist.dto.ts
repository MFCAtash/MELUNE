import { ArrayMinSize, IsArray, IsString } from "class-validator";

/** The full, new ordering of song IDs — every song currently in the
 *  playlist must appear exactly once, or the service rejects it. */
export class ReorderPlaylistDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  songIds: string[];
}
