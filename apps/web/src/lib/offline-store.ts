/**
 * Offline audio cache (item 4, phase 8) — deliberately IndexedDB, not
 * localStorage: localStorage is synchronous, string-only, and capped
 * around 5-10MB total, all three of which make it unusable for
 * multi-megabyte audio blobs. IndexedDB stores Blobs natively and has
 * no practical size ceiling for this use case (browsers grant a share
 * of free disk space, usually gigabytes).
 *
 * This is the single source of truth for "is this song downloaded" on
 * the main thread. public/sw.js duplicates the read side of this same
 * schema (DB name/version/store) so it can serve cached audio while
 * offline even for requests this module didn't initiate — see the
 * comment block at the top of sw.js for why that can't just `import`
 * this file.
 */

export const OFFLINE_DB_NAME = "melune-offline";
export const OFFLINE_DB_VERSION = 1;
export const OFFLINE_STORE = "tracks";

export interface OfflineTrackRecord {
  id: string;
  url: string;
  blob: Blob;
  title: string;
  artist: string;
  coverUrl: string | null;
  mimeType: string;
  sizeBytes: number;
  cachedAt: number;
}

export type OfflineTrackMeta = Omit<OfflineTrackRecord, "blob">;

/** Minimal shape this module needs from a track — matches @melune/types Song. */
export interface DownloadableTrack {
  id: string;
  title: string;
  audioUrl: string;
  coverUrl: string | null;
  artist: { name: string };
}

function supported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
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

/** A tiny pub/sub so any component showing download state re-renders on change. */
const listeners = new Set<() => void>();
function notifyChanged() {
  listeners.forEach((fn) => fn());
}
export function subscribeOfflineChanges(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function isTrackDownloaded(id: string): Promise<boolean> {
  if (!supported()) return false;
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(OFFLINE_STORE, "readonly");
    const req = tx.objectStore(OFFLINE_STORE).getKey(id);
    req.onsuccess = () => resolve(req.result !== undefined);
    req.onerror = () => resolve(false);
  });
}

/** Returns a fresh, caller-owned object URL for the cached blob, or null if not downloaded. */
export async function getOfflineObjectUrl(id: string): Promise<string | null> {
  if (!supported()) return null;
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(OFFLINE_STORE, "readonly");
    const req = tx.objectStore(OFFLINE_STORE).get(id);
    req.onsuccess = () => {
      const record = req.result as OfflineTrackRecord | undefined;
      resolve(record ? URL.createObjectURL(record.blob) : null);
    };
    req.onerror = () => resolve(null);
  });
}

export async function listDownloadedTracks(): Promise<OfflineTrackMeta[]> {
  if (!supported()) return [];
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(OFFLINE_STORE, "readonly");
    const req = tx.objectStore(OFFLINE_STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as OfflineTrackRecord[]) ?? [];
      resolve(rows.map(({ blob: _blob, ...meta }) => meta));
    };
    req.onerror = () => resolve([]);
  });
}

/**
 * Downloads `track.audioUrl` and stores it whole. `onProgress` (0-1) is
 * best-effort — only fires when the response sends Content-Length,
 * which S3/MinIO always does for a plain GET of a known object.
 */
export async function downloadTrackOffline(
  track: DownloadableTrack,
  onProgress?: (ratio: number) => void,
): Promise<void> {
  if (!supported()) throw new Error("IndexedDB unavailable");

  const res = await fetch(track.audioUrl);
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);

  const total = Number(res.headers.get("content-length")) || 0;
  const mimeType = res.headers.get("content-type") || "audio/mpeg";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) onProgress?.(Math.min(received / total, 1));
  }

  const blob = new Blob(chunks as BlobPart[], { type: mimeType });

  const record: OfflineTrackRecord = {
    id: track.id,
    url: track.audioUrl,
    blob,
    title: track.title,
    artist: track.artist.name,
    coverUrl: track.coverUrl,
    mimeType,
    sizeBytes: blob.size,
    cachedAt: Date.now(),
  };

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readwrite");
    tx.objectStore(OFFLINE_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  notifyChanged();
}

export async function deleteTrackOffline(id: string): Promise<void> {
  if (!supported()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readwrite");
    tx.objectStore(OFFLINE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notifyChanged();
}

export function offlineDownloadsSupported(): boolean {
  return supported();
}
