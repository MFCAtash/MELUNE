/**
 * `PushManager.subscribe` wants the VAPID public key as a raw
 * `Uint8Array`, but env vars / API responses only carry it as the
 * URL-safe base64 string the server printed (see generate-vapid-keys.js).
 * This is the standard conversion (same one used in most Push API
 * examples/MDN) — no crypto library needed, it's just base64.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  // Explicit ArrayBuffer: `PushManager.subscribe` requires a BufferSource
  // backed by a plain ArrayBuffer (not SharedArrayBuffer), and TS 5.7 models
  // that distinction on typed arrays.
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** True only when every API this feature needs actually exists on this browser. */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}
