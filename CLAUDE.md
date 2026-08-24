<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown,
Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend
tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through
`vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for
information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a
`vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do
different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the
project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+ release. Add a tool name
to select part of the graph. For example, run `vp toolchain vite`. Use `--global` to ignore the
local `vite-plus` package. Use `vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation,
      run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include
      its output when asking for help.

<!--VITE PLUS END-->

<!--CAPUCHO START-->

# Capuchoo

Capuchoo delivers over-the-air and native updates to Capacitor applications. Read
[docs/MONOREPO.md](./docs/MONOREPO.md) for the layout, its "Invariants that bite" section for the
rules that are answers to specific live bugs, and its "Known gaps" for what is deliberately
unfinished. [docs/DEPLOY.md](./docs/DEPLOY.md) covers hosting the backend and dashboard,
[docs/SUPABASE-KEYS.md](./docs/SUPABASE-KEYS.md) which Supabase key belongs where, and
[docs/RELEASING.md](./docs/RELEASING.md) how the packages reach npm, and
[docs/ADDING-AN-APP.md](./docs/ADDING-AN-APP.md) what onboarding an app involves.

## Boundaries that matter

- **`@capuchoo/core` depends on nothing, and must stay that way.** It is imported by the CLI in
  Node, by the updater inside a WebView, and by the backend and dashboard. A single dependency there
  leaks into all of them.
- **The update decision lives in `packages/core/src/update-decision.ts`, and nowhere else.**
  `decideUpdate` is pure and total over a closed set of outcomes; `renderUpdateResponse` is the only
  place a wire response is shaped. The backend gathers facts and calls them - it must never branch
  on a version, an environment or a platform itself. It used to, alongside its own copies of
  `compareVersions` and the isolation rule, and every defect that reached a real device came from
  that duplication. A new outcome means a new member of `UpdateDecision` and a new row in
  `update-decision.test.ts`, not an `if` in a service.
- **The CLI owns the deploy pipeline.** It does not call an application's `package.json` scripts,
  does not assume pnpm, and treats Trapeze, `@capacitor/assets` and `@capacitor/cli` as optional. A
  missing tool is a skip or a substitution with an explanation, never a half-finished deploy.
- **Nothing writes to a committed env file.** Build values are passed as environment variables.
  `version-code.json` is the only tracked file a deploy modifies, and only after the artefact
  exists.
- **Validate before doing work.** The old pipeline bumped the version first and discovered a missing
  env file second. Cheap checks go before anything that mutates or uploads.

## Runtime traps, all of them previously live bugs

- `notifyAppReady()` must be called early and unconditionally. It confirms the _running_ bundle
  booted; if the plugin does not hear it within `appReadyTimeout` it rolls back. It is not a gate on
  auto-update.
- `autoUpdate` must be `"onlyDownload"` or `false` when the app drives updates itself. `true` means
  the plugin and the app both apply bundles.
- One endpoint decides updates: `POST /api/update`. It is the only one that consults the channel's
  native version and an OTA bundle's `min_update_version`.
- Send the real current bundle version, never a constant.
- The OTA archive must use forward-slash entry names and have `index.html` at its root. The Android
  unzip rejects a backslash outright.
- A release APK with no signature will not install. The CLI refuses to publish one.

## Toolchain

`vp` is the entry point. There is no bare `vite` binary - the catalog aliases `vite` to
`@voidzero-dev/vite-plus-core`, which installs no executable. Use `vp build` / `vp dev` /
`vp preview`.

Shared dependency versions live in the `pnpm-workspace.yaml` catalog; write `"catalog:"` rather than
a range. Capacitor versions in particular must match across the updater, the plugin and the apps.

Do not add per-package `check` scripts - `vp check` covers the workspace once.

## Before saying something works

`vp run -r build && vp run -r test && vp check`. For the deploy pipeline, run it against a real
app - `capuchoo config list` shows what resolved, and `capuchoo deploy ota --dry-run` exercises
everything except the upload.

<!--CAPUCHO END-->
