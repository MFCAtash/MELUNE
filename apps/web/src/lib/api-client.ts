import { ApiClient } from "@codex-music/api-client";
import { useAuthStore } from "../store/auth-store";

/**
 * Base URL used by the browser.
 *
 * The production stack (Option B: Caddy on one Oracle VM) serves the web app
 * and the API from the same origin, so an empty base URL is correct there:
 * `fetch("/api/...")` hits Caddy, which proxies `/api/*` to the API
 * container. This removes CORS and cross-site cookie problems entirely.
 *
 * Set NEXT_PUBLIC_API_URL only when the API lives on a different origin
 * (for example web on Vercel + api.example.com on the VM).
 */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000");

export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken: () => useAuthStore.getState().accessToken,
  onTokenRefreshed: (accessToken) => {
    const { user } = useAuthStore.getState();
    useAuthStore.getState().setSession(accessToken ? user : null, accessToken);
  },
});
