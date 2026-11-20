#!/usr/bin/env node
/**
 * Generates a VAPID key pair for Web Push (RFC 8292) and prints them in
 * .env-ready form. Run once per environment and keep the private key
 * secret — anyone with it can send push messages "as" your app to any
 * subscriber, and rotating it invalidates every existing subscription
 * (clients silently re-subscribe on their next visit, so this is safe
 * but not free).
 *
 * Usage: npm run generate:vapid   (from apps/api)
 */
const webpush = require("web-push");

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("Add these to apps/api/.env (and NEXT_PUBLIC_VAPID_PUBLIC_KEY to apps/web/.env):\n");
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VAPID_SUBJECT=mailto:support@codexmusic.app`);
console.log(`\nNEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
