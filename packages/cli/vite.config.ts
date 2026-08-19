import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    // Node-only package: no jsdom, no browser globals.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
