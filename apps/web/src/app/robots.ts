import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Admin, private library pages and the API are crawl-blocked. Media lives on
 * its own subdomain (MEDIA_DOMAIN, e.g. music-media.melune.app) and is not
 * advertised here.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/library",
          "/onboarding",
          "/reset-password",
          "/forgot-password",
          "/_next/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
