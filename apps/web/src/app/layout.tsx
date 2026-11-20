import type { Metadata, Viewport } from "next";
import { Sora, Inter, Vazirmatn, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { PlayerEngine } from "@/components/player/player-engine";
import { PersistentPlayer } from "@/components/player/persistent-player";
import { KeyboardShortcutsProvider } from "@/components/keyboard/keyboard-shortcuts-provider";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";

// Brand identity type system (Phase 6.6):
//  - Sora   → display font, headings/titles/logo. Geometric + a bit of
//             character, unlike the system-default fallback stack.
//  - Inter  → body font, everything else in Latin script. Tuned for small
//             UI text.
//  - Vazirmatn → Persian body/display font used app-wide when locale = fa
//             (RTL). Selected because it pairs cleanly with Sora's
//             geometry and has full Farsi digit + diacritic support.
// All three load as CSS variables so Tailwind can reference them (see
// `fontFamily` in tailwind.config.ts) and the RTL override in
// globals.css can swap the whole app to Vazirmatn without a JS reflow.
const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-fa",
  display: "swap",
});

// MELUNE brand voice: Cormorant Garamond is a poetic serif — high
// contrast strokes with calligraphic details — used ONLY for the
// wordmark and brand moments (never UI text). Light weights read as
// engraved/luxury at the sizes a logo is shown at.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute origin for canonical URLs, OpenGraph images and the sitemap.
  // NEXT_PUBLIC_SITE_URL is baked in at build time (docker-compose.prod.yml).
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "music",
  keywords: SITE_KEYWORDS,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    alternateLocale: ["fa_IR"],
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "MELUNE — Your Music. Smarter.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  // PWA installability (Phase 6.7) — see public/manifest.webmanifest and
  // public/sw.js for what "offline" actually covers here (app shell,
  // not downloaded audio).
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SITE_NAME,
  },
};

/**
 * Structured data for Google's rich results. Organization + WebSite let the
 * search engine attach the logo and site name to the domain, and
 * SoftwareApplication describes the product itself.
 */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icons/icon-512.png`,
        width: 512,
        height: 512,
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: ["en", "fa"],
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "MusicApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
};

// Reads the persisted locale synchronously, before React hydrates, and
// applies `lang`/`dir` immediately — the same "no flash" trick theme
// switchers use. Keep this in lockstep with locale-store's storage key
// ("melune-locale") and RTL_LOCALES in lib/i18n/config.ts.
const NO_FLASH_LOCALE_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem("melune-locale");
    var locale = raw ? JSON.parse(raw).state.locale : "en";
    var dir = locale === "fa" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  } catch (e) {}
})();
`;

// Same trick for the light/dark preference (Phase 6.7). Keep the storage
// key in lockstep with theme-store.ts ("melune-theme"). Runs before the
// CSS variables in globals.css are applied by the browser, so there's no
// flash of the wrong theme on load.
const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem("melune-theme");
    var theme = raw ? JSON.parse(raw).state.theme : "dark";
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
`;

// Same trick for the AMOLED ambient mode — reads the persisted key
// `ambient-theme-store.ts` writes ("melune-ambient-mode"). Runs *after*
// the theme script above, since selecting "amoled" also forces dark —
// without this, a page reload while amoled+dark is active would paint
// the regular dark background for one frame before React hydrates and
// `ambient-theme-store.ts` fixes it up, which is exactly the flash this
// pattern exists to avoid for theme/locale already.
const NO_FLASH_AMOLED_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem("melune-ambient-mode");
    var mode = raw ? JSON.parse(raw).state.mode : "dynamic";
    if (mode === "amoled") {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.dataset.amoled = "true";
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      dir="ltr"
      data-theme="dark"
      className={`${sora.variable} ${inter.variable} ${vazirmatn.variable} ${cormorant.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_LOCALE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_AMOLED_SCRIPT }} />
        <script
          type="application/ld+json"
          // JSON.stringify output is safe: none of these values come from
          // user input. `</script>` cannot appear in the static literals.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </head>
      <body>
        <Providers>
          {children}
          <PlayerEngine />
          <PersistentPlayer />
          <KeyboardShortcutsProvider />
          <ServiceWorkerRegister />
        </Providers>
      </body>
    </html>
  );
}
