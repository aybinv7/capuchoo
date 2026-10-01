import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import Icons from "unplugin-icons/vite";
import IconsResolver from "unplugin-icons/resolver";
import Components from "unplugin-vue-components/vite";
import { defineConfig } from "vite-plus";
import {
  Framework7VueResolver,
  getFramework7AutoImports,
} from "./src/shared/utils/resolvers/resolvers.js";

const SRC = fileURLToPath(new URL("./src", import.meta.url));

// Read once so Settings can show the real name and version without importing the manifest
// into the bundle.
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { name: string; version: string };

export default defineConfig({
  define: {
    __APP_NAME__: JSON.stringify("Capuchoo"),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  plugins: [
    vue({
      template: {
        compilerOptions: {
          // jeep-sqlite is a custom element, not a Vue component.
          isCustomElement: (tag) => tag === "jeep-sqlite" || tag.startsWith("swiper-"),
        },
      },
    }),

    tailwindcss(),

    Icons({ autoInstall: true, compiler: "vue3" }),

    VueI18nPlugin({
      include: [fileURLToPath(new URL("./src/locales/**", import.meta.url))],
    }),

    /**
     * Composition API, i18n, vueuse and the Framework7 helpers are available without an import
     * line. `auto-imports.d.ts` and `components.d.ts` are generated on first run and are what makes
     * the editor, `vue-tsc` and the build agree - they are artifacts, not files to hand-edit.
     */
    AutoImport({
      include: [/\.[tj]sx?$/, /\.vue$/, /\.vue\?vue/],
      imports: ["vue", "vue-i18n", "@vueuse/core", getFramework7AutoImports()],
      dirs: [
        "src/shared/composables/**",
        "src/shared/utils/**",
        "src/plugins/**",
        "src/modules/**/composables/**",
      ],
      dts: "auto-imports.d.ts",
      vueTemplate: true,
      viteOptimizeDeps: true,
      injectAtEnd: true,
      dirsScanOptions: { types: true },
    }),

    /**
     * `Framework7VueResolver` is why no screen imports an `f7-*` component and why the app never
     * calls `registerComponents`: each component is pulled from `framework7-vue` exactly where it
     * is used. Icons resolve through the same pass, so `<i-f7-house-fill />` needs no import.
     */
    Components({
      dts: "components.d.ts",
      dirs: ["src/shared/components/**", "src/modules/**/views/**", "src/modules/**/components/**"],
      extensions: ["vue", "ts"],
      deep: true,
      resolvers: [
        Framework7VueResolver(),
        IconsResolver({
          prefix: "i",
          alias: { f7: "framework7", mt: "material-symbols" },
          enabledCollections: ["framework7", "material-symbols", "lucide"],
        }),
      ],
    }),
  ],

  resolve: { alias: { "@": SRC } },
  /** The browser cannot call the API cross-origin, so `vp dev` proxies it to CAPUCHOO_DEV_SERVER. */
  server: {
    port: 5173,
    proxy: {
      "/api": { target: process.env.CAPUCHOO_DEV_SERVER ?? "http://localhost:3000", changeOrigin: true },
    },
  },
  build: { target: "esnext" },
  test: { server: { deps: { inline: ["@material/material-color-utilities"] } } },
  lint: { options: { typeAware: false } },
  /**
   * The unplugin declaration files are committed - vue-tsc has no idea what `ref` or an F7
   * component is without them - but the generator rewrites them on every run, and what it emits is
   * not what oxfmt emits. Formatting them means a build and a commit hook take turns rewriting a
   * file no human wrote and no human can keep formatted.
   */
  fmt: {
    ignorePatterns: ["**/auto-imports.d.ts", "**/components.d.ts"],
  },
});
