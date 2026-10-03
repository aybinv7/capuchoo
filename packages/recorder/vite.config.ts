import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/worker.ts", "src/updater.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    platform: "neutral",
    clean: true,
  },
  test: {
    environment: "happy-dom",
  },
});
