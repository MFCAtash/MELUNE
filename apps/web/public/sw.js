/**
 * MELUNE service worker.
 *
 * Phase 6.7 scope: make the *app shell* — the JS/CSS bundle, fonts,
 * icons, and a friendly offline page — available without a network, so
 * opening the app with no connection doesn't just show the browser's
 * dinosaur. Static assets are cached opportunistically the first time
 * they're fetched (stale-while-revalidate) and served from cache on
 * every visit after — no Workbox / next-pwa, since Next's build output
 * filenames are content-hashed and only known after `next build`.
 *
 * Phase 8 adds two things:
 *
 * 1. Offline audio playback. Downloaded tracks live in IndexedDB
 *    (db "codex-offline", store "tracks", keyPath "id" — see
 *    src/lib/offline-store.ts, which is this SW's source of truth for
 *    the schema). The player itself already prefers a cached blob over
 *    the network when the app is open (see player-engine.tsx), so this
 *    SW's job is the case that misses: any GET for a URL we've cached
 *    that reaches the network layer at all — a stale <audio> element,
 *    a retry, a request made outside the player — falls through to the
 *    IndexedDB copy when the network fetch fails. This SW is plain
 *    vanilla JS with no bundler, so it can't `import` offline-store.ts;
 *    the tiny bit of read-only IndexedDB logic below is duplicated by
 *    hand instead. Keep DB_NAME/DB_VERSION/STORE in sync with that file.
 *
 * 2. Web Push. `push` decrypts and shows the notification the API sent
 *    (see apps/api/src/push/push.service.ts); `notificationclick`
 *    focuses an existing tab or opens a new one at the payload's `url`.
 */

const CACHE = "codex-shell-v2";
const OFFLINE_URL = "/offline.html";

const OFFLINE_DB_NAME = "codex-offline";
const OFFLINE_DB_VERSION = 1;
const OFFLINE_STORE = "tracks";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// ---- Offline audio: read-only mirror of src/lib/offline-store.ts ----

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    // Mirrors the main-thread module's upgrade path so a first-ever
    // request handled by the SW (before the page has opened the DB
    // itself) still creates the store instead of failing.
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
        const store = db.createObjectStore(OFFLINE_STORE, { keyPath: "id" });
        store.createIndex("by-url", "url", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Looks up a cached track blob by its original remote URL. */
async function matchOfflineBlobByUrl(url) {
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(OFFLINE_STORE, "readonly");
      const index = tx.objectStore(OFFLINE_STORE).index("by-url");
      const req = index.get(url);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Page navigations: network first (content should be fresh), fall
  // back to a cached copy of that exact page, then the offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match(OFFLINE_URL)),
    );
    return;
  }

  // Cross-origin: normally always network (API calls, arbitrary
  // cover/audio hosts) — except a downloaded track's audio URL, which
  // gets a network-first-then-IndexedDB fallback so it still plays
  // with no connection even outside the player's own blob-URL path.
  if (!sameOrigin) {
    if (request.destination === "audio" || /\.(mp3|m4a|aac|ogg|wav|flac)(\?|$)/i.test(url.pathname)) {
      event.respondWith(
        fetch(request).catch(async () => {
          const cached = await matchOfflineBlobByUrl(request.url);
          if (!cached) throw new Error("no offline copy");
          return new Response(cached.blob, {
            headers: { "Content-Type": cached.mimeType || "audio/mpeg" },
          });
        }),
      );
    }
    return;
  }

  const cacheable =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/");
  if (!cacheable) return;

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    ),
  );
});

// ---- Web Push ----

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Codex Music", body: event.data.text() };
  }

  const title = payload.title || "Codex Music";
  const options = {
    body: payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/home", ...payload.data },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/home";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        // Reuse an already-open tab rather than piling up new ones.
        if ("focus" in client) {
          client.navigate(targetUrl).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
