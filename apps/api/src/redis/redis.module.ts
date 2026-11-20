import { Global, Logger, Module, OnApplicationShutdown, Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";
import { CacheService } from "./cache.service";

const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const logger = new Logger("Redis");
    const url = config.get<string>("REDIS_URL", "redis://localhost:6379");
    const isTest = process.env.NODE_ENV === "test";

    const client = new Redis(url, {
      // Never crash the process over a Redis blip — retry with backoff and
      // let CacheService's try/catch degrade individual calls in the
      // meantime.
      //
      // In test env this is tuned the other way: fail fast instead of
      // queuing/retrying, so e2e suites never hang for several seconds per
      // cached call when no Redis container is available in CI — a cache
      // miss there is the correct, immediate outcome, not a slow one.
      maxRetriesPerRequest: isTest ? 0 : 2,
      retryStrategy: isTest ? () => null : (attempt) => Math.min(attempt * 200, 5000),
      connectTimeout: isTest ? 1000 : 10000,
      enableOfflineQueue: !isTest,
      lazyConnect: isTest,
    });

    client.on("error", (err) => logger.warn(`Redis connection error: ${err.message}`));
    client.on("connect", () => logger.log(`Connected to Redis at ${url}`));

    return client;
  },
};

@Global()
@Module({
  providers: [redisProvider, CacheService],
  exports: [CacheService, REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor() {}

  async onApplicationShutdown() {
    // Individual client shutdown is handled by Nest's DI teardown order;
    // nothing extra needed here beyond existing since ioredis closes on
    // process exit. Left as an explicit hook point for future use
    // (e.g. flushing in-flight cache writes).
  }
}
