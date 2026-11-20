import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LoginScreen } from "./src/screens/LoginScreen";
import { PlayerScreen } from "./src/screens/PlayerScreen";
import { apiClient, loadPersistedAccessToken, setAccessToken } from "./src/lib/api-client";

/**
 * INITIAL SKELETON — see apps/mobile/README.md.
 *
 * No navigation library (no Expo Router / React Navigation yet, despite
 * the root README's tech-stack table naming Expo Router as the eventual
 * stack) — just screens swapped with local state. That's a deliberate
 * scope cut for this skeleton, not an oversight: routing, deep links, and
 * a design system are the next real chunk of Phase 10 work.
 *
 * Boot sequence (Phase 10 "next step" #2 — persistent auth, done):
 *   1. "checking" — try to load a token expo-secure-store saved from a
 *      previous session.
 *   2. No token found → go straight to LoginScreen.
 *   3. Token found → confirm it still works with one cheap authenticated
 *      call (`GET /users/me`) rather than assuming it's still valid,
 *      since there is no refresh token to fall back on if it expired.
 *   4. That call succeeds → PlayerScreen. Fails (expired/revoked) →
 *      clear the stale token and go to LoginScreen, same as a fresh
 *      install.
 */
type BootState = "checking" | "loggedOut" | "loggedIn";

export default function App() {
  const [boot, setBoot] = useState<BootState>("checking");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await loadPersistedAccessToken();

      if (!token) {
        if (!cancelled) setBoot("loggedOut");
        return;
      }

      try {
        await apiClient.getMe();
        if (!cancelled) setBoot("loggedIn");
      } catch {
        // Expired or revoked — this client has no refresh token to try
        // instead, so treat it exactly like "never logged in".
        setAccessToken(null);
        if (!cancelled) setBoot("loggedOut");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (boot === "checking") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0B0B12" }}>
        <StatusBar style="light" />
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      {boot === "loggedIn" ? (
        <PlayerScreen onLoggedOut={() => setBoot("loggedOut")} />
      ) : (
        <LoginScreen onLoggedIn={() => setBoot("loggedIn")} />
      )}
    </>
  );
}
