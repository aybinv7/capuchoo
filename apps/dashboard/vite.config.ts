import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite-plus";

import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";

const API_TARGET = process.env.CAPUCHOO_API_TARGET ?? "http://localhost:3000";

/**
 * The dashboard is a static site whose host proxies `/api` to `@capuchoo/server` (a Render rewrite,
 * or Traefik path routing), so the API is always the relative, same-origin `/api`. In development
 * the proxy keeps that true: `changeOrigin` stays off so the server sees the dev host in both
 * `Host` and `Origin` and its CSRF check passes for cookie writes.
 */
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: false,
        ws: false,
      },
    },
  },
  build: {
    cssCodeSplit: true,
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@vue-flow")) return "vue-flow";
          if (id.includes("leaflet")) return "leaflet";
          if (id.includes("reka-ui") || id.includes("@floating-ui")) return "reka";
          if (/[\\/](vue|@vue|vue-router|pinia|@tanstack)[\\/]/.test(id)) return "framework";
          return undefined;
        },
      },
    },
  },
});
