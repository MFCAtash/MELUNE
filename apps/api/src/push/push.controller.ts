import { Body, Controller, Delete, HttpCode, Post } from "@nestjs/common";
import { PushService } from "./push.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user";
import { SubscribePushDto, UnsubscribePushDto } from "./dto/subscribe-push.dto";

@Controller("me/push")
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post("subscribe")
  @HttpCode(204)
  subscribe(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubscribePushDto) {
    return this.push.subscribe(user.id, dto);
  }

  @Delete("subscribe")
  @HttpCode(204)
  unsubscribe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UnsubscribePushDto) {
    return this.push.unsubscribe(user.id, dto.endpoint);
  }
}
