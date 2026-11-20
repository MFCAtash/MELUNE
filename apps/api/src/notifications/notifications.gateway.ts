import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AuthenticatedUser } from "../auth/types/authenticated-user";
import { createWsExecutionContext } from "../common/ws/ws-execution-context";

type AuthenticatedSocket = Socket & { user?: AuthenticatedUser };

/**
 * Real-time half of the notifications feature. Purely server-to-client:
 * clients never emit anything here, they just connect (authenticated,
 * see JwtAuthGuard.getRequest) and get placed in a private per-user room
 * so `notifyUser` can target exactly the tabs/devices belonging to one
 * account.
 *
 * This *replaces client-side polling* of GET /me/notifications — it does
 * not replace Web Push (PushService), which remains the channel used
 * when the user has no tab open at all.
 */
@Injectable()
@WebSocketGateway({
  namespace: "notifications",
  cors: {
    // Mirrors main.ts's app.enableCors({ origin: CORS_ORIGIN }) for the
    // HTTP API. This callback runs per-handshake (at request time), so
    // reading process.env here is safe even though @WebSocketGateway's
    // options object is built when this file is first loaded — by the
    // time a real client connects, ConfigModule has long since loaded
    // .env into process.env during bootstrap.
    //
    // CORS_ORIGIN may be a comma-separated list (apex + www, or a staging
    // origin). Returning the whole string as a single origin — which an
    // earlier version did — makes every real handshake fail; compare the
    // request origin against the parsed list instead.
    origin: (origin, callback) => {
      const allowed = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      // Native clients and same-origin tools may omit Origin entirely.
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed`));
    },
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(private readonly jwtAuthGuard: JwtAuthGuard) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const context = createWsExecutionContext(
        client,
        NotificationsGateway,
        this.handleConnection,
      );
      const allowed = await this.jwtAuthGuard.canActivate(context);
      if (!allowed || !client.user?.id) {
        throw new UnauthorizedException();
      }
    } catch (err) {
      this.logger.debug(
        `Rejected notifications socket ${client.id}: ${(err as Error).message}`,
      );
      client.emit("notification:error", { message: "Unauthorized" });
      client.disconnect(true);
      return;
    }

    await client.join(this.userRoom(client.user!.id));
    this.logger.debug(`Notifications socket connected: user=${client.user!.id} socket=${client.id}`);
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.logger.debug(`Notifications socket disconnected: socket=${client.id}`);
  }

  /**
   * Called by NotificationsService right after it persists a
   * notification (in `create`) so every open tab/device for that user
   * refreshes instantly instead of waiting for their next poll.
   * Silently a no-op if the user has no socket connected — the
   * notification still exists in the DB and, separately, went out over
   * Web Push.
   */
  notifyUser(userId: string): void {
    this.server.to(this.userRoom(userId)).emit("notification:new");
  }

  /** Same as `notifyUser`, batched for fan-outs like new-release pushes. */
  notifyUsers(userIds: string[]): void {
    if (userIds.length === 0) return;
    this.server.to(userIds.map((id) => this.userRoom(id))).emit("notification:new");
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
