import { Global, Module } from "@nestjs/common";
import { PushController } from "./push.controller";
import { PushService } from "./push.service";

// Global for the same reason as NotificationsModule: NotificationsService
// sends a push alongside every in-app notification it creates, so it
// needs PushService without CatalogModule/AuthModule importing this
// module's whole graph just to reach it transitively.
@Global()
@Module({
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
