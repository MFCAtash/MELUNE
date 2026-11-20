import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Next.js uses the automatic JSX runtime (tsconfig "jsx": "preserve" is
  // transformed by SWC). Vitest/esbuild defaults to the classic runtime,
  // which makes every JSX test fail with "React is not defined".
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
