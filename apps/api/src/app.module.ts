import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { ClientIpThrottlerGuard } from "./common/guards/client-ip-throttler.guard";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { QueueModule } from "./queue/queue.module";
import { StorageModule } from "./storage/storage.module";
import { PushModule } from "./push/push.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { HealthModule } from "./health/health.module";
import { MailModule } from "./mail/mail.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CatalogModule } from "./catalog/catalog.module";
import { UserLibraryModule } from "./library/library.module";
import { DiscoverModule } from "./discover/discover.module";
import { SearchModule } from "./search/search.module";
import { RecommendationsModule } from "./recommendations/recommendations.module";
import { AdminModule } from "./admin/admin.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { RoomsModule } from "./rooms/rooms.module";
import { validateEnv } from "./config/env.validation";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"],
      // Runs once at boot, before any module below gets a ConfigService —
      // a missing/weak JWT_ACCESS_SECRET (or a malformed DATABASE_URL/
      // REDIS_URL/expiry string) now fails startup with one aggregated,
      // readable error instead of surfacing later as a confusing runtime
      // failure the first time something touches that value.
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    RedisModule,
    QueueModule,
    StorageModule,
    MailModule,
    PushModule,
    NotificationsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    UserLibraryModule,
    DiscoverModule,
    SearchModule,
    RecommendationsModule,
    AdminModule,
    AnalyticsModule,
    RoomsModule,
  ],
  providers: [
    // Applies the default limit above (100 req/min) to every route.
    // Sensitive routes (auth login/register/forgot-password) tighten this
    // with their own @Throttle(...) override; hot, read-heavy public
    // routes (discover, catalog browsing, search) opt out with
    // @SkipThrottle() or set their own higher limit instead of stacking a
    // second ThrottlerGuard per-controller.
    //
    // ClientIpThrottlerGuard is the same guard with a proxy-aware tracker:
    // behind Cloudflare + Caddy, plain req.ip is the proxy address, not the
    // visitor's.
    { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
  ],
})
export class AppModule {}
