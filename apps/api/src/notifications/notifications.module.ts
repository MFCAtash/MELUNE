import { Global, Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { NotificationsGateway } from "./notifications.gateway";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

// Global: SongsService (new-release fan-out) and AuthService (welcome
// notification) both need NotificationsService without importing the
// whole NotificationsModule graph into CatalogModule/AuthModule.
//
// JwtAuthGuard is instantiated again here (a second instance from the
// one AuthModule registers as APP_GUARD) purely so NotificationsGateway
// can inject it directly — it only needs a Reflector (available
// everywhere, no import required) and relies on the "jwt" passport
// strategy that JwtStrategy registers globally with passport once
// AuthModule loads, so this does not need to import AuthModule itself.
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, JwtAuthGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
