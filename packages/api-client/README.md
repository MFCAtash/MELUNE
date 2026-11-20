# @melune/api-client

Typed HTTP client shared by the Next.js web app and the Expo mobile app.

## Public surface

```ts
export interface ApiClientOptions { /* baseUrl, fetch impl, token accessors */ }
export class ApiError extends Error { status, body }   // transport + API errors
export class ApiClient { /* catalog, library, auth, search, uploads */ }
```

Payload shapes for writes are exported as `SongWritePayload`, `AlbumWritePayload`,
`ArtistWritePayload` and `GenreWritePayload`; responses use the types from
[`@melune/types`](../types).

## Design rules

- **One place for endpoint URLs.** Never string-concatenate `/api/...` in a screen.
- **Same-origin first.** When no `baseUrl` is supplied, requests go to relative
  paths so production traffic stays on one origin (no CORS, no cross-site cookies).
- **Errors are values.** Non-2xx responses throw `ApiError` carrying the HTTP
  status and parsed body, which matches `ApiErrorBody` from `@melune/types`.
- **No React/DOM dependencies** except through the injected `fetch`, so the same
  client works under Expo, Next.js server components and tests.

## Usage

```ts
import { ApiClient } from "@melune/api-client";

const api = new ApiClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL || "" });

const page = await api.listSongs({ page: 1, limit: 20 });
const song = await api.getSong("bi-ehsas");
```

Server-side callers in the web app generally bypass this package and use
`apps/web/src/lib/catalog.ts` with an absolute internal URL; the browser uses this
package. Both consume the identical types.

## Adding an endpoint

1. Add/extend the response type in [`@melune/types`](../types) if needed.
2. Add the method here with a named parameter object and a documented return type.
3. Use it from every consumer — do not hand-roll `fetch` in a component.
