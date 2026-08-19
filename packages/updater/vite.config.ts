import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    // Three entries, matching the three export subpaths. `capacitor-config` is
    // separate because capacitor.config.ts imports it in Node, where no
    // Capacitor runtime exists.
    entry: ["src/index.ts", "src/vue.ts", "src/capacitor-config.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    platform: "neutral",
    clean: true,
  },
});
