import { IsIn } from "class-validator";

export class UpdateUserRoleDto {
  @IsIn(["USER", "ARTIST", "ADMIN"])
  role: "USER" | "ARTIST" | "ADMIN";
}
