import { Inject, Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";

/**
 * Thin caching layer over ioredis. Every method fails *open*: if Redis is
 * down or a value fails to (de)serialize, callers get a cache miss (or the
 * write is silently dropped) instead of a 500 — Redis here is strictly a
 * performance optimization, never a source of truth, so nothing in the API
 * should become unavailable just because the cache is.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return undefined;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`cache get failed for "${key}": ${(err as Error).message}`);
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (err) {
      this.logger.warn(`cache set failed for "${key}": ${(err as Error).message}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(`cache del failed for [${keys.join(", ")}]: ${(err as Error).message}`);
    }
  }

  /**
   * Deletes every key matching a prefix (e.g. `songs:list:*`). Uses SCAN
   * rather than KEYS so a large keyspace never blocks Redis's single
   * event loop, at the cost of not being perfectly atomic — acceptable
   * here since stale cache entries just get overwritten on next read.
   */
  async delByPrefix(prefix: string): Promise<void> {
    try {
      const stream = this.redis.scanStream({ match: `${prefix}*`, count: 100 });
      const toDelete: string[] = [];
      for await (const keys of stream) {
        toDelete.push(...(keys as string[]));
      }
      if (toDelete.length > 0) {
        await this.redis.del(...toDelete);
      }
    } catch (err) {
      this.logger.warn(`cache delByPrefix failed for "${prefix}": ${(err as Error).message}`);
    }
  }

  /**
   * Cache-aside helper: return the cached value, or compute it via
   * `loader`, cache it, and return it. The most common call shape in the
   * codebase, so every read-through cache site looks the same.
   */
  async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;

    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Atomically increments a counter, setting its TTL the moment it's
   * first created (so the window is fixed from the first hit, not
   * refreshed on every increment). Used for things like the login
   * failed-attempt counter, where a lost increment under Redis pressure
   * just means one fewer strike against the caller — never a reason to
   * fail the request itself.
   *
   * Fails open: on error this returns 0, i.e. "not yet over any
   * threshold", rather than blocking the caller because Redis is down.
   */
  async increment(key: string, ttlSeconds: number): Promise<number> {
    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, ttlSeconds);
      }
      return count;
    } catch (err) {
      this.logger.warn(`cache increment failed for "${key}": ${(err as Error).message}`);
      return 0;
    }
  }
}
