import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RoomsGateway } from "./rooms.gateway";

/**
 * JwtAuthGuard is provided here (as in NotificationsModule) so the gateway
 * can inject it. It only needs Reflector plus the globally-registered
 * "jwt" passport strategy, so importing the whole AuthModule isn't needed.
 */
@Module({
  providers: [RoomsGateway, JwtAuthGuard],
  exports: [RoomsGateway],
})
export class RoomsModule {}
