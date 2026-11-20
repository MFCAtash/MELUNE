import { ApiClient } from "@codex-music/api-client";
import * as SecureStore from "expo-secure-store";

/**
 * INITIAL SKELETON — see apps/mobile/README.md.
 *
 * Wires the same `@codex-music/api-client` the web app uses to a
 * module-level access token, now backed by `expo-secure-store` so it
 * survives an app restart (Phase 10 "next step" #2 — done). This is
 * still NOT a full auth solution:
 *
 *  - Only the *access* token is persisted. There is no refresh token to
 *    persist alongside it: the refresh flow relies on an httpOnly
 *    cookie the way the web app's browser does, and React Native has
 *    no cookie jar by default, so `onTokenRefreshed`/silent refresh is
 *    still a no-op past the initial login (see `ApiClient`'s class
 *    comment in `@codex-music/api-client`).
 *  - Practical effect: once the (short-lived) access token expires,
 *    the persisted value stops working and the app falls back to
 *    `LoginScreen` — same as a first launch, just delayed until
 *    expiry instead of happening on every restart. That's the
 *    documented, honest scope of this fix.
 *  - Fixing refresh for real needs either a cookie-jar-aware fetch
 *    polyfill or an API change so non-browser clients get a refresh
 *    token in the response body — not decided, not started.
 */

const ACCESS_TOKEN_KEY = "codex-music.accessToken";

let accessToken: string | null = null;

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api";

export const apiClient = new ApiClient({
  baseUrl: API_URL,
  getAccessToken: () => accessToken,
  onTokenRefreshed: (token) => {
    accessToken = token;
    persistToken(token);
  },
});

/** Fire-and-forget write to SecureStore; a failed write just means the
 *  next cold start won't have a token, which degrades to LoginScreen —
 *  not a crash, so callers don't need to await or handle this. */
function persistToken(token: string | null): void {
  const op = token ? SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token) : SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  op.catch((err) => {
    console.warn("codex-music: failed to persist access token", err);
  });
}

/**
 * Called directly by LoginScreen after a successful `apiClient.login()`.
 * Kept as a separate export (rather than folding callers into
 * `onTokenRefreshed` alone) because `App.tsx`'s logout path also needs
 * to clear the in-memory + persisted token without going through a
 * network call.
 */
export function setAccessToken(token: string | null): void {
  accessToken = token;
  persistToken(token);
}

/**
 * Loads whatever access token was saved from a previous session, if
 * any, and sets it as the client's current in-memory token.
 *
 * Does NOT validate it — an expired token is returned as-is; the first
 * authenticated request made with it will simply 401. `App.tsx` is
 * responsible for treating "loaded a token but the first request using
 * it failed" as "session expired, show LoginScreen", since this module
 * has no opinion on navigation.
 */
export async function loadPersistedAccessToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  accessToken = token;
  return token;
}
