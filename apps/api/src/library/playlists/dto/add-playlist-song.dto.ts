import { IsString } from "class-validator";

export class AddPlaylistSongDto {
  @IsString()
  songId: string;
}
