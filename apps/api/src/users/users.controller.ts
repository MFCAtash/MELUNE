import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.users.findById(user.id);
  }

  @Patch("me")
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.updateMe(user.id, dto);
  }

  @Get("me/stats")
  getMyStats(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getStats(user.id);
  }

  @Public()
  @Get(":id")
  getById(@Param("id") id: string) {
    return this.users.findById(id);
  }
}
