import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Rate-limit keyed by the real client IP.
 *
 * The production request path is:
 *
 *   browser -> Cloudflare -> Caddy -> NestJS
 *
 * Express's `req.ip` would otherwise be the Caddy container address for
 * every visitor, turning the global 100 req/min budget into one shared
 * bucket: a single busy user would 429 everyone else. Cloudflare sets
 * `CF-Connecting-IP` (and Caddy preserves it), so prefer that, then the
 * first `X-Forwarded-For` hop, then the socket address for direct/local
 * traffic and tests.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const cf = req.headers?.["cf-connecting-ip"];
    if (typeof cf === "string" && cf.trim()) {
      return cf.trim();
    }

    const forwarded = req.headers?.["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first;
    }

    return req.ip ?? "unknown";
  }
}
