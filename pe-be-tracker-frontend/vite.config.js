/* eslint-env node */
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { fileURLToPath, URL } from "node:url";

import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "");
  const hasSentrySourceMaps = Boolean(
    env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT,
  );

  const plugins = [
    react(),
    tailwindcss(),
    visualizer({
      filename: "stats.html",
      gzipSize: true,
      brotliSize: true,
    }),
  ];
  if (hasSentrySourceMaps) {
    plugins.push(
      sentryVitePlugin({
        authToken: env.SENTRY_AUTH_TOKEN,
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        telemetry: false,
        release: {
          name: env.SENTRY_RELEASE || env.VITE_APP_VERSION || undefined,
        },
        sourcemaps: {
          filesToDeleteAfterUpload: [
            "dist/**/*.js.map",
            "dist/**/*.mjs.map",
            "dist/**/*.css.map",
          ],
        },
      }),
    );
  }

  return {
    build: {
      sourcemap: hasSentrySourceMaps,
    },
    plugins,
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@/shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
        "@/features": fileURLToPath(new URL("./src/features", import.meta.url)),
        "@/app": fileURLToPath(new URL("./src/app", import.meta.url)),
        "@/utils": fileURLToPath(new URL("./src/utils", import.meta.url)),
        "@/contexts": fileURLToPath(new URL("./src/contexts", import.meta.url)),
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      globals: true,
      exclude: [
        "e2e/**",
        "node_modules/**",
        "playwright-report/**",
        "test-results/**",
      ],
    },
  };
});
