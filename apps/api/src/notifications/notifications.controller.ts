import { Controller, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";

@Controller("me/notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.notifications.findMine(user.id, query);
  }

  @Get("unread-count")
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Patch(":id/read")
  @HttpCode(204)
  markRead(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(user.id, id);
  }

  @Post("read-all")
  @HttpCode(204)
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id);
  }
}
