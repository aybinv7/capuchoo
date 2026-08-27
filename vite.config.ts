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
 * from `package.json` dependencies. Because `@capuchoo/updater` depends on
 * `@capuchoo/core`, and the apps depend on both, `vp run -r build` already
 * builds in the correct order without a hand-written task graph.
 */
export default defineConfig({
  fmt: {
    // Generated files. Formatting them is pointless: the generator rewrites
    // them unformatted on the next build, so `vp check` would fail again the
    // moment anyone builds.
    ignorePatterns: ["**/auto-imports.d.ts", "**/components.d.ts", "**/typed-router.d.ts"],
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
      // Type-aware lint rules are on, but oxlint does not report tsc
      // diagnostics here.
      //
      // Its type checker cannot resolve `.vue` single-file components - that
      // needs Volar - so enabling typeCheck across this workspace produced
      // ~180 phantom "Cannot find module './Foo.vue'" errors in the two Vue
      // apps and drowned every real finding.
      //
      // Type checking still happens, with the tool that understands each
      // package: vue-tsc for apps/dashboard, tsc for the CLI,
      // the backend and the plugin, and tsdown's --dts for core and updater.
      // All of them run in `vp run -r build`.
      typeAware: true,
      typeCheck: false,
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",

      // Application code should log through its own logger, but the imported
      // apps have existing console.log calls and failing the build over them
      // would just get the gate switched off. Visible, not blocking.
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
    overrides: [
      {
        // A CLI's entire job is writing to stdout, the backend logs to it, and
        // a release script's whole output is the report it prints.
        files: ["packages/cli/**", "services/back/**", "scripts/**"],
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

          // The rule cannot see through a helper that asserts on the caller's
          // behalf, and reports the test as having none. Naming ours keeps the
          // rule useful instead of switching it off - a test that genuinely
          // asserts nothing is still reported.
          "vitest/expect-expect": [
            "warn",
            { assertFunctionNames: ["expect", "expectAdditiveChange"] },
          ],
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
      // an app's `vp dev`, because the apps import them from `dist`.
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

      // What the registry says, which is the only place a stale release shows
      // up: a package already published at this version, with a different
      // public API, will be skipped while its dependents publish against the
      // old one. Needs `vp run -r build` first, and never cached - the answer
      // depends on npm, not on this checkout.
      "release:check": {
        command: "node scripts/check-release.mjs",
        cache: false,
      },

      // Asks a *running* backend whether it still speaks the plugin's contract.
      // The unit tests prove the decision; only this proves the deployment.
      // Takes a bundle id: `vp run smoke -- com.efficy.app`.
      smoke: {
        command: "node scripts/contract-smoke.mjs",
        cache: false,
      },
    },
  },
});
