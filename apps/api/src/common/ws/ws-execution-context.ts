import { ExecutionContext } from "@nestjs/common";
import type { Socket } from "socket.io";

/**
 * Nest only runs Guards/Interceptors/Pipes around `@SubscribeMessage`
 * handlers — never around a gateway's `handleConnection` lifecycle hook,
 * because that hook isn't dispatched through Nest's normal argument-host
 * pipeline. To still authenticate the handshake with the project's real
 * `JwtAuthGuard` (rather than duplicating token-verification logic), this
 * builds the minimal `ExecutionContext` shape that guard needs:
 *   - getType()              -> "ws" (so JwtAuthGuard branches correctly)
 *   - getHandler()/getClass() -> real references, so Reflector-based
 *                                metadata lookups (e.g. @Public()) work
 *   - switchToWs().getClient() -> the connecting socket
 *
 * Only used for this one purpose (gateway connection auth) — regular
 * `@SubscribeMessage` handlers should prefer `@UseGuards(JwtAuthGuard)`
 * directly, which Nest wires up for free.
 */
export function createWsExecutionContext(
  client: Socket,
  target: { new (...args: never[]): unknown },
  handler: (...args: never[]) => unknown,
): ExecutionContext {
  return {
    getClass: () => target,
    getHandler: () => handler,
    getArgs: () => [client],
    getArgByIndex: (index: number) => [client][index],
    switchToHttp: () => {
      throw new Error("HTTP context is not available during a WebSocket handshake");
    },
    switchToRpc: () => {
      throw new Error("RPC context is not available during a WebSocket handshake");
    },
    switchToWs: () => ({
      getClient: () => client,
      getData: () => undefined,
      getPattern: () => undefined,
    }),
    getType: () => "ws",
  } as unknown as ExecutionContext;
}
