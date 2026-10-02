import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/main.ts", "src/migrate.ts", "src/admin.ts", "src/seed-demo.ts"],
    format: ["esm"],
    platform: "node",
    target: "node22",
    sourcemap: true,
    clean: true,
    dts: false,
  },
  test: {
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
