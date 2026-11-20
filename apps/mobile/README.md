# @codex-music/mobile

The MELUNE Expo / React Native client. It shares the typed contract with the web
app through `@codex-music/types` and `@codex-music/api-client`, so API shapes
cannot drift between platforms.

## Stack

- Expo SDK 51, React Native 0.74, React 18.2
- `expo-av` for playback
- `expo-secure-store` for the access/refresh tokens (never plain AsyncStorage)
- Metro bundler; deep link scheme `codexmusic://`

## Layout

```
src/lib/        api-client wiring, auth token storage, player helpers
src/screens/    one file per screen (auth, home/search, library, player, ...)
app.json        Expo config: bundle id app.codexmusic.mobile, dark UI only
```

## Running

```bash
npm ci
npx expo start --workspace=apps/mobile   # or: cd apps/mobile && npx expo start
```

Scan the QR code with Expo Go, or press `a`/`i` for an emulator/device build.

## Configuration

| Variable | Meaning |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Absolute API base for device builds. Expo exposes `EXPO_PUBLIC_*` at build time; leave it unset to use the same-origin default baked into `api-client`. |

Do **not** hardcode hosts inside `src/` — route everything through the shared
client so a deployment change touches one place.

## Notes for contributors

- Keep screens presentational; data fetching goes through `@codex-music/api-client`.
- Token handling must keep using `expo-secure-store`; adding plain storage is a
  security regression.
- RTL/Persian behaviour must match the web app.
- This package keeps its own nested React version (`18.2.0`) because Expo pins it;
  do not "upgrade" it independently of the Expo SDK.
