/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Caddy/Cloudflare already add their own headers; the framework version is
  // not useful to clients and is one less fingerprint to leak.
  poweredByHeader: false,
  // Workspace packages ship raw TypeScript (`main: src/index.ts`), so Next
  // must compile them itself — required for `next build` in a clean checkout
  // and inside the Docker image.
  transpilePackages: ["@melune/types", "@melune/api-client"],
  images: {
    // Song/album/artist artwork is a free-form URL (see songs/albums DTOs)
    // — there is no fixed storage domain yet (Storage phase not built), so
    // we can't allowlist specific hosts. Wildcarding every https host keeps
    // next/image's optimizer, lazy loading and layout-shift protection
    // working for whatever domain a given song's coverUrl points at.
    // http://localhost is required for locally-served demo artwork
    // (cover/audio URLs are absolute, so next/image validates the host).
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
};

module.exports = nextConfig;
