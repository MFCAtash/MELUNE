import { IsEnum, IsInt, IsString, Matches, Max, Min } from "class-validator";
import { UploadKind } from "../storage.constants";

export class CreateUploadUrlDto {
  @IsEnum(UploadKind)
  kind: UploadKind;

  /** Original filename, used only to preserve the extension server-side. */
  @IsString()
  @Matches(/^[\w,\s\-().]+\.[A-Za-z0-9]{1,10}$/, {
    message: "filename must include a valid extension",
  })
  filename: string;

  @IsString()
  contentType: string;

  @IsInt()
  @Min(1)
  @Max(200 * 1024 * 1024)
  sizeBytes: number;
}
