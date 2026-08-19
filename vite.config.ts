import { defineConfig } from "vite-plus";

/**
 * Workspace root configuration.
 *
 * This file owns everything shared across packages: lint and format rules, the
 * `vp check` composition, and the tasks that fan out over the workspace.
 * Per-package Vite/Vitest configuration stays in each package's own
 * `vite.config.ts`.
 *
 * Workspace membership itself lives in `pnpm-workspace.yaml` - Vite+ delegates
 * package resolution to pnpm and layers the task runner on top.
 *
 * Ordering note: `vp run -r <task>` walks the workspace dependency graph built
 * from `package.json` dependencies. Because `@capucho/updater` depends on
 * `@capucho/core`, and the apps depend on both, `vp run -r build` already
 * builds in the correct order without a hand-written task graph.
 */
export default defineConfig({
  fmt: {
    overrides: [
      {
        files: ["**/*.md"],
        options: {
          proseWrap: "always",
        },
      },
    ],
  },

  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    ignorePatterns: [
      "**/dist/**",
      "**/node_modules/**",
      "**/android/**",
      "**/ios/**",
      // Generated declaration files - unplugin writes these, nobody edits them.
      "**/auto-imports.d.ts",
      "**/components.d.ts",
      "**/typed-router.d.ts",
      "**/.eslintrc-auto-import.json",
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      // Application code logs through its own logger; warn/error stay allowed
      // so genuine failures are still visible.
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
    overrides: [
      {
        // A CLI's entire job is writing to stdout, and the backend logs to it.
        files: ["packages/cli/**", "services/back/**"],
        env: { node: true },
        rules: {
          "no-console": "off",
        },
      },
      {
        files: ["**/*.test.ts", "**/*.spec.ts"],
        plugins: ["vitest"],
        rules: {
          "typescript/no-explicit-any": "off",
        },
      },
    ],
  },

  run: {
    // Cache both `vite.config.ts` tasks and `package.json` scripts. Long-lived
    // commands opt out individually with `cache: false`.
    cache: true,

    tasks: {
      // Build only the publishable libraries. Run this before
      // `vp -C apps/template dev`, because the apps import them from `dist`.
      libs: {
        command: 'vp run --filter "./packages/**" build',
        cache: false,
      },

      // Everything a pull request must satisfy. Sub-commands are cached
      // independently by Vite Task.
      //
      // `vp check` is the built-in and lints the whole workspace in one pass,
      // so it is not run per package.
      ci: {
        command: ["vp check", "vp run -r --cache build", "vp run -r --cache test"],
        cache: false,
      },
    },
  },
});
