import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as webpush from "web-push";
import { PrismaService } from "../prisma/prisma.service";
import { SubscribePushDto } from "./dto/subscribe-push.dto";

export interface PushPayload {
  title: string;
  body?: string;
  /** Deep-link the client should navigate to on click, e.g. "/song/abc". */
  url?: string;
  /** Arbitrary structured data (mirrors Notification.data). */
  data?: Record<string, unknown>;
}

/**
 * Sends Web Push notifications (RFC 8030/8291) directly to browsers via
 * VAPID — no third-party push service (FCM/OneSignal/etc) required, since
 * the Push API's underlying transport (browser-vendor push services) is
 * reached straight from the server using the subscription's own endpoint.
 *
 * This is a *delivery* layer only: NotificationsService still owns what
 * a notification says and who it's for (the in-app `Notification` row
 * is the source of truth), and calls into this service as a best-effort
 * side channel — a push failure must never fail the request that
 * triggered the notification (song upload, signup, ...).
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  readonly configured: boolean;
  readonly publicKey: string | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const publicKey = this.config.get<string>("VAPID_PUBLIC_KEY");
    const privateKey = this.config.get<string>("VAPID_PRIVATE_KEY");
    const subject = this.config.get<string>("VAPID_SUBJECT") || "mailto:support@melunemusic.app";

    this.configured = Boolean(publicKey && privateKey);
    this.publicKey = publicKey;

    if (this.configured) {
      webpush.setVapidDetails(subject, publicKey!, privateKey!);
    } else {
      this.logger.warn(
        "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are not set — run `npm run generate:vapid` in apps/api. " +
          "Push subscribe/send is a no-op until then (in-app notifications still work).",
      );
    }
  }

  /** Upserts on `endpoint`: re-subscribing the same device just refreshes its keys. */
  async subscribe(userId: string, dto: SubscribePushDto): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
      },
      // A subscription is device-bound, not account-bound — if a
      // different user is now signed in on this browser, hand the
      // endpoint over to them rather than erroring.
      update: {
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
      },
    });
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  /**
   * Sends `payload` to every device the user has subscribed on. Never
   * throws — logs and continues past individual failures. A 404/410
   * from the browser's push service means that endpoint is gone for
   * good (uninstalled, permission revoked, expired), so that
   * subscription row is deleted instead of retried forever.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.configured) return;

    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId } });
      if (subscriptions.length === 0) return;

      await Promise.all(
        subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              JSON.stringify(payload),
            );
          } catch (err) {
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
            } else {
              this.logger.warn(`Push send failed for subscription ${sub.id}: ${(err as Error).message}`);
            }
          }
        }),
      );
    } catch (err) {
      this.logger.warn(`sendToUser(${userId}) failed: ${(err as Error).message}`);
    }
  }

  /** Fan-out helper: same payload to many users (e.g. every follower of an artist). */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (!this.configured || userIds.length === 0) return;
    await Promise.all(userIds.map((id) => this.sendToUser(id, payload)));
  }
}
