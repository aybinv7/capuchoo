import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    // Node-only package: no jsdom, no browser globals.
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Generating an ECDSA key pair through WebCrypto takes seconds on a shared CI runner the
    // first time; the 5 s default failed two signing tests there while they pass in 100 ms here.
    testTimeout: 20000,
  },
});
