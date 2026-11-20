import { Controller, Get, Inject } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorFunction,
} from "@nestjs/terminus";
import type Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";
import { Public } from "../auth/decorators/public.decorator";
import { REDIS_CLIENT } from "../redis/redis.constants";

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    const checkDatabase: HealthIndicatorFunction = async () => {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: "up" } };
    };

    // Redis is a soft dependency (caching only — CacheService fails open),
    // so a downed Redis is reported as "down" here for visibility without
    // failing the whole health check or blocking traffic.
    const checkRedis: HealthIndicatorFunction = async () => {
      try {
        await this.redis.ping();
        return { redis: { status: "up" } };
      } catch (err) {
        return { redis: { status: "down", message: (err as Error).message } };
      }
    };

    return this.health.check([checkDatabase, checkRedis]);
  }
}
