import { NotificationsGateway } from "./notifications.gateway";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types/authenticated-user";

function mockSocket(user?: AuthenticatedUser) {
  return {
    id: "socket-1",
    user,
    handshake: { auth: {}, query: {}, headers: {} },
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
  } as unknown as import("socket.io").Socket & { user?: AuthenticatedUser };
}

describe("NotificationsGateway", () => {
  let gateway: NotificationsGateway;
  let guard: { canActivate: jest.Mock };
  let server: { to: jest.Mock; emit: jest.Mock };

  beforeEach(() => {
    guard = { canActivate: jest.fn() };
    gateway = new NotificationsGateway(guard as unknown as JwtAuthGuard);
    server = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
    // @ts-expect-error private field set for the test
    gateway.server = server;
  });

  describe("handleConnection", () => {
    it("joins the per-user room when the guard authenticates the handshake", async () => {
      const client = mockSocket();
      guard.canActivate.mockImplementation(async () => {
        (client as unknown as { user: { id: string } }).user = { id: "user-1" };
        return true;
      });

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith("user:user-1");
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it("disconnects the socket when the guard rejects the handshake", async () => {
      const client = mockSocket();
      guard.canActivate.mockRejectedValue(new Error("invalid token"));

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith("notification:error", { message: "Unauthorized" });
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });

    it("disconnects the socket when the guard passes but leaves no user attached", async () => {
      const client = mockSocket();
      guard.canActivate.mockResolvedValue(true);

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe("notifyUser / notifyUsers", () => {
    it("emits notification:new to exactly that user's room", () => {
      gateway.notifyUser("user-1");
      expect(server.to).toHaveBeenCalledWith("user:user-1");
      expect(server.emit).toHaveBeenCalledWith("notification:new");
    });

    it("emits to every room in a fan-out, and is a no-op for an empty list", () => {
      gateway.notifyUsers(["user-1", "user-2"]);
      expect(server.to).toHaveBeenCalledWith(["user:user-1", "user:user-2"]);

      server.to.mockClear();
      gateway.notifyUsers([]);
      expect(server.to).not.toHaveBeenCalled();
    });
  });
});
