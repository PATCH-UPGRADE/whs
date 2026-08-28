import path from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  build: {
    minify: "esbuild",
  },
  // Entanglement uses constructor names to match concrete classes to schema
  // entries (for example, SyncOwner). Preserve them in production bundles.
  esbuild: {
    keepNames: true,
  },
  test: {
    setupFiles: ["./src/tests/setup-websocket.ts"],
    server: {
      deps: {
        inline: ["entanglement-react"],
      },
    },
  },
  server: {
    cors: {
      origin: "http://localhost:8080",
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
    proxy: {
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
        rewrite: (path) => path.replace(/^\/ws/, ""),
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@novnc/novnc/core/rfb.js": "/node_modules/@novnc/novnc/core/rfb.js",
    },
    // Force single instances when consuming linked local packages.
    dedupe: [
      "@hadron/entanglement",
      "@hadron/entanglement/persistence",
      "@hadron/entanglement/filter",
      "react",
      "react-dom",
    ],
  },
});
