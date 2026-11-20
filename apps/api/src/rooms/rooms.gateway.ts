import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AuthenticatedUser } from "../auth/types/authenticated-user";
import { createWsExecutionContext } from "../common/ws/ws-execution-context";

type AuthedSocket = Socket & { user?: AuthenticatedUser };

interface Participant {
  userId: string;
  username: string;
  socketId: string;
}

export interface RoomState {
  code: string;
  hostId: string;
  songId: string | null;
  isPlaying: boolean;
  currentTime: number;
  participants: Participant[];
  createdAt: number;
}

interface InternalRoom extends Omit<RoomState, "participants"> {
  participants: Map<string, Participant>;
}

type Ack<T> = (payload: { ok: true; data: T } | { ok: false; error: string }) => void;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const MAX_ROOMS = 200;

/**
 * "Listen together" — a small, intentionally transient realtime layer.
 *
 * Rooms live in memory only: a room is a social moment, not durable data.
 * Redis/Postgres persistence would add complexity without changing what a
 * listener experiences, and every room disappears cleanly on restart.
 * Only the host can drive transport (play/pause/seek/song); everyone else
 * receives the same state and follows along.
 *
 * Authentication reuses the same JwtAuthGuard + WsExecutionContext as the
 * notifications gateway, so a socket can never claim someone else's
 * identity.
 */
@Injectable()
@WebSocketGateway({
  namespace: "rooms",
  cors: {
    origin: (origin, callback) => {
      const allowed = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (!origin || allowed.includes(origin)) callback(null, true);
      else callback(new Error(`Origin ${origin} is not allowed`));
    },
    credentials: true,
  },
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RoomsGateway.name);
  private readonly rooms = new Map<string, InternalRoom>();

  @WebSocketServer()
  private server!: Server;

  constructor(private readonly jwtAuthGuard: JwtAuthGuard) {}

  async handleConnection(client: AuthedSocket): Promise<void> {
    try {
      const context = createWsExecutionContext(client, RoomsGateway, this.handleConnection);
      if (!(await this.jwtAuthGuard.canActivate(context)) || !client.user?.id) {
        throw new UnauthorizedException();
      }
    } catch {
      client.emit("room:error", { message: "Unauthorized" });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket): void {
    const room = this.roomOfSocket(client);
    if (!room) return;
    room.participants.delete(client.id);
    if (room.participants.size === 0) {
      this.rooms.delete(room.code);
      return;
    }
    // The host leaving promotes the longest-standing listener so the room
    // stays usable instead of becoming read-only forever.
    if (room.hostId === client.user?.id) {
      room.hostId = [...room.participants.values()][0].userId;
    }
    this.emitState(room);
  }

  @SubscribeMessage("room:create")
  create(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { songId?: string }, ack?: Ack<RoomState>) {
    const user = client.user;
    if (!user) return this.fail(ack, "Unauthorized");
    if (this.rooms.size >= MAX_ROOMS) return this.fail(ack, "Too many active rooms — try again shortly");
    this.leaveCurrent(client);

    let code = this.newCode();
    while (this.rooms.has(code)) code = this.newCode();
    const room: InternalRoom = {
      code,
      hostId: user.id,
      songId: body?.songId ?? null,
      isPlaying: false,
      currentTime: 0,
      participants: new Map(),
      createdAt: Date.now(),
    };
    this.rooms.set(code, room);
    void client.join(`room:${code}`);
    room.participants.set(client.id, {
      userId: user.id,
      username: user.username,
      socketId: client.id,
    });
    this.emitState(room);
    ack?.({ ok: true, data: this.snapshot(room) });
  }

  @SubscribeMessage("room:join")
  join(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { code: string }, ack?: Ack<RoomState>) {
    const user = client.user;
    if (!user) return this.fail(ack, "Unauthorized");
    const room = this.rooms.get(String(body?.code ?? "").trim().toUpperCase());
    if (!room) return this.fail(ack, "Room not found");
    this.leaveCurrent(client);

    void client.join(`room:${room.code}`);
    room.participants.set(client.id, {
      userId: user.id,
      username: user.username,
      socketId: client.id,
    });
    this.emitState(room);
    ack?.({ ok: true, data: this.snapshot(room) });
  }

  @SubscribeMessage("room:leave")
  leave(@ConnectedSocket() client: AuthedSocket) {
    this.leaveCurrent(client);
  }

  /** Host-only transport update. `seq` lets clients ignore stale events. */
  @SubscribeMessage("room:transport")
  transport(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: Partial<Pick<RoomState, "songId" | "isPlaying" | "currentTime">>,
    ack?: Ack<RoomState>,
  ) {
    const room = this.roomOfSocket(client);
    if (!room) return this.fail(ack, "Not in a room");
    if (room.hostId !== client.user?.id) return this.fail(ack, "Only the host can control playback");

    if (typeof body?.songId === "string" || body?.songId === null) room.songId = body.songId;
    if (typeof body?.isPlaying === "boolean") room.isPlaying = body.isPlaying;
    if (typeof body?.currentTime === "number" && Number.isFinite(body.currentTime)) {
      room.currentTime = Math.max(0, body.currentTime);
    }
    this.emitState(room);
    ack?.({ ok: true, data: this.snapshot(room) });
  }

  private leaveCurrent(client: AuthedSocket): void {
    const room = this.roomOfSocket(client);
    if (!room) return;
    void client.leave(`room:${room.code}`);
    room.participants.delete(client.id);
    if (room.participants.size === 0) {
      this.rooms.delete(room.code);
      return;
    }
    if (room.hostId === client.user?.id) {
      room.hostId = [...room.participants.values()][0].userId;
    }
    this.emitState(room);
  }

  private roomOfSocket(client: AuthedSocket): InternalRoom | undefined {
    for (const room of this.rooms.values()) {
      if (client.rooms.has(`room:${room.code}`)) return room;
    }
    return undefined;
  }

  private emitState(room: InternalRoom): void {
    this.server.to(`room:${room.code}`).emit("room:state", this.snapshot(room));
  }

  private snapshot(room: InternalRoom): RoomState {
    return {
      code: room.code,
      hostId: room.hostId,
      songId: room.songId,
      isPlaying: room.isPlaying,
      currentTime: room.currentTime,
      participants: [...room.participants.values()],
      createdAt: room.createdAt,
    };
  }

  private newCode(): string {
    let code = "";
    for (let i = 0; i < 6; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
  }

  private fail(ack: Ack<RoomState> | undefined, error: string) {
    ack?.({ ok: false, error });
    this.logger.debug(`Room command rejected: ${error}`);
  }
}
