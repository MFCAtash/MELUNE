import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import type { Socket } from "socket.io";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * The same passport-"jwt" guard used to protect every HTTP route also
 * protects the Socket.io handshake for NotificationsGateway (see
 * ws-execution-context.ts for how a gateway's handleConnection builds a
 * fake ExecutionContext to run this guard outside of Nest's normal
 * request pipeline).
 *
 * passport-jwt's extractor only knows how to read `req.headers.authorization`,
 * so for the "ws" case getRequest()/getResponse() below return a
 * request-like shim built from the socket handshake instead of a real
 * Express request. AuthGuard's base canActivate() assigns the resolved
 * user onto whatever getRequest() returned, so returning the *actual*
 * socket (with `headers` shimmed onto it) means the resolved user ends
 * up on `client.user`, exactly where NotificationsGateway expects it.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      // A public route must stay reachable WITHOUT a token — but when a
      // valid token IS present we still want to resolve the user, because
      // controllers like DiscoverController use `@CurrentUser()` to add
      // personalized data on top of the public payload. Short-circuiting
      // unconditionally (the old behaviour) left `request.user` undefined
      // even for signed-in callers, so "Recently played" was always empty
      // and the discover E2E suite correctly failed.
      const request = this.getRequest(context) as { headers?: Record<string, unknown> };
      const authorization = request?.headers?.authorization;
      if (typeof authorization !== "string" || authorization.length === 0) {
        return true;
      }

      try {
        const result = super.canActivate(context);
        // Passport's HTTP guard returns a Promise. A malformed/expired
        // token must not turn a public route into a 401: allow the
        // anonymous response instead, just without a user attached.
        if (result && typeof (result as Promise<boolean>).then === "function") {
          return (result as Promise<boolean>).catch(() => true);
        }
        return result;
      } catch {
        return true;
      }
    }

    return super.canActivate(context);
  }

  getRequest(context: ExecutionContext) {
    if (context.getType() !== "ws") {
      return context.switchToHttp().getRequest();
    }

    const client = context.switchToWs().getClient<Socket>();
    const handshake = client.handshake;

    // Accept the access token from, in order: `auth.token` (the
    // recommended socket.io-client option — never logged/cached by
    // proxies the way a query string can be), `?token=` in the
    // handshake query (fallback for clients that can't set `auth`),
    // or a standard `Authorization: Bearer <token>` header.
    const authToken = (handshake.auth as Record<string, unknown> | undefined)?.token;
    const queryToken = handshake.query?.token;
    const bearerToken =
      typeof authToken === "string"
        ? authToken
        : typeof queryToken === "string"
          ? queryToken
          : Array.isArray(queryToken)
            ? queryToken[0]
            : undefined;

    // Mutate the socket itself so passport's ExtractJwt.fromAuthHeaderAsBearerToken()
    // finds a bearer token via `req.headers.authorization`, and so the
    // `user` it assigns afterwards lands on this same object (`client.user`).
    (client as unknown as { headers: Record<string, string | undefined> }).headers = {
      authorization: bearerToken ? `Bearer ${bearerToken}` : handshake.headers?.authorization,
    };

    return client;
  }

  getResponse(context: ExecutionContext) {
    if (context.getType() !== "ws") {
      return context.switchToHttp().getResponse();
    }
    // passport-jwt never touches the response, so an empty object is enough.
    return {};
  }
}
