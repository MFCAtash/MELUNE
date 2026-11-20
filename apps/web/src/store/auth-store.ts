import { create } from "zustand";
import type { User } from "@codex-music/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  /** False until the first session check (silent refresh + /users/me)
   *  has finished. Route guards and the landing redirect wait for this
   *  so they never mistake "still checking" for "logged out". */
  ready: boolean;
  setSession: (user: User | null, accessToken: string | null) => void;
  setReady: () => void;
  clear: () => void;
}

// Access token lives in memory only (never localStorage) — the refresh
// token is the persistent credential, and it's an httpOnly cookie the
// API set, so client-side JS never touches it either.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  ready: false,
  setSession: (user, accessToken) => set({ user, accessToken }),
  setReady: () => set({ ready: true }),
  clear: () => set({ user: null, accessToken: null }),
}));
