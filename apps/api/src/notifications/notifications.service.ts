import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { Paginated, PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { PushService } from "../push/push.service";
import { NotificationsGateway } from "./notifications.gateway";

/** Central catalog of notification types, so callers never hand-type a string. */
export const NotificationType = {
  NEW_RELEASE: "new_release",
  WELCOME: "welcome",
} as const;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Creates the in-app notification row (the source of truth — what the
   * bell/inbox reads), best-effort mirrors it as a Web Push message to
   * every device the user has subscribed (for when no tab is open), and
   * best-effort emits it over the NotificationsGateway socket to every
   * currently-open tab/device (for when one is). Both side channels are
   * fire-and-forget: if either fails, or the user has no subscription /
   * no open socket, the in-app notification still exists as the source
   * of truth.
   */
  async create(
    userId: string,
    type: string,
    title: string,
    body?: string,
    data?: Prisma.InputJsonObject,
    pushUrl?: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, data },
    });
    void this.push.sendToUser(userId, { title, body, url: pushUrl, data });
    this.gateway.notifyUser(userId);
    return notification;
  }

  /**
   * Fans out a "new release" notification to every user who has this
   * artist saved in their library (LibraryItem itemType=ARTIST). Uses
   * createMany for a single round trip regardless of audience size, and
   * never throws — a notification fan-out failing should never roll back
   * the song creation that triggered it.
   */
  async notifyNewRelease(artistId: string, artistName: string, songId: string, songTitle: string): Promise<void> {
    try {
      const followers = await this.prisma.libraryItem.findMany({
        where: { itemType: "ARTIST", artistId },
        select: { userId: true },
      });
      if (followers.length === 0) return;

      const title = `New release from ${artistName}`;
      await this.prisma.notification.createMany({
        data: followers.map((f) => ({
          userId: f.userId,
          type: NotificationType.NEW_RELEASE,
          title,
          body: songTitle,
          data: { artistId, songId },
        })),
      });

      const followerIds = followers.map((f) => f.userId);

      // createMany doesn't return rows / doesn't fan out push or the
      // socket event by itself, so mirror both here — same best-effort
      // contract as `create`.
      void this.push.sendToUsers(followerIds, {
        title,
        body: songTitle,
        url: `/song/${songId}`,
        data: { artistId, songId },
      });
      this.gateway.notifyUsers(followerIds);
    } catch (err) {
      this.logger.warn(`Failed to fan out new-release notifications: ${(err as Error).message}`);
    }
  }

  async welcome(userId: string, username: string): Promise<void> {
    try {
      await this.create(
        userId,
        NotificationType.WELCOME,
        `Welcome to Codex Music, ${username}!`,
        "Start by liking a few songs so we can personalize your Home feed.",
        undefined,
        "/home",
      );
    } catch (err) {
      this.logger.warn(`Failed to create welcome notification: ${(err as Error).message}`);
    }
  }

  async findMine(userId: string, query: PaginationQueryDto): Promise<Paginated<unknown>> {
    const where = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException("Notification not found");
    }
    if (notification.readAt) return;

    await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
