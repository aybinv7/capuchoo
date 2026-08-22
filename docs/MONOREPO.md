# The monorepo

How this workspace is put together, and why each decision was made the way it was. If you are
looking for how the parts fit together, the invariants below are the ones worth knowing.

## Layout

```
capuchoo/
├── packages/
│   ├── core/           @capuchoo/core          contract shared by everything
│   ├── updater/        @capuchoo/updater       app-side runtime
│   ├── cli/            @capuchoo/cli          build and publish releases
├── apps/
│   ├── dashboard/      @capuchoo/dashboard     orgs, apps, channels, releases
│   └── template/       @capuchoo/template      reference Capacitor application
├── services/
│   └── back/           @capuchoo/back          update server
├── vite.config.ts      lint, format, and the fan-out tasks
├── pnpm-workspace.yaml membership, catalog, build-script approvals
└── tsconfig.base.json  compiler options packages extend
```

The dependency direction is one-way and worth keeping that way:

```
core  <-  updater  <-  template
  \                       ^
   \-- cli ---------------/        (cli is a devDependency of the app)
```

`core` depends on nothing. That is what lets the CLI import it in Node, the updater import it inside
a WebView, and the backend and dashboard import it in their own environments - without any of them
dragging in the others.

## The toolchain is Vite+

`vp` supplies the task runner (with caching and dependency ordering), the formatter, the linter, the
test runner, library builds, and a wrapper over the package manager. Workspace membership still
lives in `pnpm-workspace.yaml`; Vite+ delegates resolution to pnpm and layers on top.

```sh
vp install              # install everything
vp run -r build         # build every package, in dependency order
vp run -r test          # 85 tests across core, cli and updater
vp check                # format + lint + type-aware rules, whole workspace
vp run libs             # just the publishable packages
vp run ci               # what CI runs
```

Two rules that catch people out:

- `vp <name>` is a built-in; `vp run <name>` is a `package.json` script or a `vite.config.ts` task.
  `vp build` and `vp run build` are **not** the same command.
- There is no bare `vite` binary. The catalog aliases `vite` to `@voidzero-dev/vite-plus-core`,
  which installs no executable. Use `vp build`, `vp dev`, `vp preview`. Two packages were still
  calling `vite` directly and could not build until this was fixed.

Full docs are vendored at `node_modules/vite-plus/docs`.

## Versions live in one place

`pnpm-workspace.yaml` holds a catalog. A package writes `"catalog:"` instead of a range:

```json
{ "dependencies": { "@capacitor/core": "catalog:" } }
```

agree _exactly_, or the native bridge loads two copies of the runtime and plugin calls resolve
against the wrong one. `catalogMode: prefer` means a package that forgets `catalog:` still lands on
the pinned version.

`overrides.vite` and `peerDependencyRules.allowAny: [vite]` come from the Vite+ scaffold and are not
optional: without them every package that peer-depends on upstream `vite` pulls in a second, real
copy alongside the alias.

## Build script approvals are decisions, not noise

`allowBuilds` lists every dependency permitted to run install-time code, with a reason. `false`
entries are meaningful - they record that a package was reviewed and refused, and stop pnpm asking
again.

Two are load-bearing: `vue-demi`'s postinstall picks the Vue 2 or Vue 3 shim (without it, everything
built on vue-demi resolves to a stub), and `protobufjs` generates its runtime helpers.

If `vp install` reports new ignored builds it will append placeholder entries reading
`set this to true or false`. Replace them - the placeholders are not valid YAML, and leaving them
breaks every subsequent pnpm command.

## Adding a package

1. `mkdir packages/<name>` with a `package.json` named `@capuchoo/<name>`.
2. Extend the shared compiler options:
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": { "outDir": "dist", "rootDir": "src" },
     "include": ["src/**/*.ts"]
   }
   ```
3. For a library, add a `vite.config.ts` with a `pack` block and `"build": "vp pack"`. Use
   `platform: "neutral"` unless it genuinely needs Node.
4. Use `"catalog:"` for anything already in the catalog.
5. Add `"vite-plus": "catalog:"` to devDependencies. It ships the test runner, so **do not add
   `vitest`** - tests import from `vite-plus/test`. This is the convention in
   `sig/presalio-monorepo` and `ayb/capubridge`.
6. `vp install`.

`services/back` and `apps/dashboard` are the exception to step 5: they rely on the root install and
declare no `vite-plus` of their own. Both pin an older `@types/node` than the catalog resolves for,
so a direct dependency made pnpm install a _second_ `@voidzero-dev/vite-plus-core` under a different
peer set - and the dashboard's `vite.config.ts` then mixed types from both copies, failing `vue-tsc`
with `TS2321: Excessive stack depth`. `vite-plus/test` resolves from the root either way, so
`"test": "vp test --run"` works without the dependency. Bump their `@types/node` before adding it
back.

Do not add a `check` script - `vp check` covers the workspace in one pass, and a per-package one
would run the linter N times over the same files.

Publishing is described in [RELEASING.md](./RELEASING.md): four packages go to npm, the apps and the
backend are `private: true`, and one workflow covers all of them.

Ordering is automatic: `vp run -r build` walks the graph built from `package.json` dependencies.
Declare the dependency and the order follows; there is no separate task graph to maintain.

### Why the CLI is built with `tsc`, not `vp pack`

oclif discovers commands by walking `dist/commands`, one module per command. A bundler collapses
those into one file and oclif finds nothing. Anything under `src/commands/` becomes a command, which
is why the shared deploy implementation lives in `src/deploy/execute.ts` - as
`src/commands/deploy/shared.ts` it was picked up as a broken `deploy shared` command.

## Type checking

Each package is checked by the tool that understands it:

| Package             | Checked by      |
| ------------------- | --------------- |
| core, updater       | `vp pack --dts` |
| dashboard, template | `vue-tsc`       |

All of them run inside `vp run -r build`, so a type error fails the build.

oxlint's own tsc diagnostics are **off** (`lint.options.typeCheck: false`). Its type checker cannot
resolve `.vue` single-file components - that needs Volar - so enabling it produced ~180 phantom
"Cannot find module './Foo.vue'" errors and drowned every real finding. Type-aware lint _rules_ stay
on.

## Releasing

**The CLI** - tag `cli-v<version>` matching `packages/cli/package.json`. The workflow verifies they
agree, builds, tests, and publishes to npm with provenance. Nothing writes back to the repository.

**An app** - run the `deploy-app` workflow, or `capuchoo deploy ota` locally. Both take the same
path through the CLI. Git owns tags and history; Capuchooo owns channels, activation and rollback.

`@capuchoo/core` and `@capuchoo/updater` are not published yet. Apps in this workspace consume them
through `workspace:*`. Publishing them needs the `@capuchoo` npm scope; until then an external app
links them by path, as Lowmaro does.

## Working on an app that depends on a library

The apps import `@capuchoo/updater` from its `dist`, so build the libraries first:

```sh
vp run libs
vp -C apps/template dev
```

Or run `vp pack --watch` in `packages/updater` alongside the app's dev server.

## Where the history went

The five original repositories - `capucho-cli`, `capucho-back`, `capucho-front`, `capucho-app`,
**2026-08-21**. They still exist on GitHub under those names, unchanged, as the archive.

Every pre-migration commit is reachable from this repository: the subtree imports gave it six roots.

```sh
git rev-list --max-parents=0 HEAD   # 6 roots
git log <old-sha>                   # any pre-migration commit
```

`git log --follow` will not cross a subtree merge for a moved file - inherent to subtree imports.
Use `git log --all -- '*<filename>'` instead.

## Invariants that bite

Learned the hard way; each one was a live bug.

- **`notifyAppReady()` early and unconditional.** It confirms the _running_ bundle booted. If the
  plugin does not hear it within `appReadyTimeout` it rolls back - so gating it, or awaiting a
  network call first, reverts working updates. It is not a gate on auto-update.
- **`autoUpdate: "onlyDownload"`** whenever the app drives updates itself, or the plugin and the UI
  both apply bundles.
- **One endpoint decides updates: `POST /api/update`.** It is the only one that consults the
  channel's native version and an OTA bundle's `min_update_version`. Send the real current bundle
  version, never a constant.
- **`channels.current_version_id` decides what is served.** `active` on a version row only means the
  artefact _may_ be served. An upload that does not move the channel pointer serves nothing.
- **`devices` is the authoritative device row**, and `device_channels` is only a binding. Read the
  former for anything a dashboard shows.
- **The backend needs the Supabase _secret_ key.** Its own writes target tables with row level
  security whose policies assume an authenticated user; a publishable key is silently rejected. See
  [SUPABASE-KEYS.md](./SUPABASE-KEYS.md).
- **OTA archives** need forward-slash entry names and `index.html` at the root; the Android unzip
  rejects a backslash outright.
- **An unsigned release APK will not install.** The CLI refuses to publish one without
  `--allow-unsigned`.
- **Check the row, not the code.** Three separate defects here read correctly in the source and were
  only visible in the database: a dashboard endpoint reading the wrong table, missing snake_case
  field mappings, and the unset channel pointer. Verify against the live system.

## Known gaps

Verified 2026-08-22.

**Needs a decision or a credential**

- `deploy-app.yml` cannot run: the repository has **no secrets configured at all**. It needs
  `CAPUCHOO_ENDPOINT`, `CAPUCHOO_API_KEY`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- iOS has no CI path: it needs a macOS runner, a signing certificate and a provisioning profile. The
  updater's native install path is Android-only by nature - an iOS binary cannot be side-loaded - so
  iOS gets OTA bundles and store builds, nothing else.
- The Supabase `updates` bucket is **public**: `uploadFile` hands out `getPublicUrl`, and the
  `createSignedUrl` path sits unused two lines above. Every bundle and APK URL is downloadable by
  anyone holding the link.
- No custom domain in front of the backend, so renaming the Render service again would strand every
  installed build. See [DEPLOY.md](./DEPLOY.md).

**Never exercised**

- `deploy native --type release`: no app in this workspace has a `signingConfig` driven by
  `CAPUCHOO_KEYSTORE_*`, so signing, the unsigned-APK refusal and the install have only been tested
  by unit tests.
- The native update flow on a device - `downloadNativeUpdate()`, `openNativeInstaller()`.
- `POST /api/downloaded`, `/applied`, `/failed`: their action values are fixed but nothing calls
  them yet, and OTA telemetry still depends on whatever the plugin posts to `statsUrl`. inspection,
  but no Android or iOS build has compiled them.
- `apps/template` has no cloud app - `capuchoo init` relinks it - so it has never been deployed.

**Deliberately not done**

- The dashboard cannot upload an OTA bundle. Deploys are CLI-only by choice.
- `getBuiltinVersion()` is not reported: the server has no column for it.
- The four `/api/dashboard/apps*` routes look unused, but the dashboard reads apps through Supabase
  directly, so confirm that before deleting them. `/api/apps/:id/channels` and `/:id/releases` _are_
  used - by the CLI.
- TypeScript stays on 5.x: oclif's typings and `vue-tsc` are not validated on 7.x yet.

## Conventions

- Code, comments, commit messages and PR descriptions in English.
- `.capuchoo/project.json` is committed - it identifies the app and is not a secret.
  `.capuchoo/config.json` holds the API key and is git-ignored.
- `build/<env>/.env.<env>` files are committed on purpose: they hold public build configuration (app
  id, display name, update endpoint, channel) that Trapeze and Vite both read. Real secrets go in
  `.env.local`, which is ignored.
- The CLI never writes to an env file. A deploy modifies exactly one tracked file,
  `version-code.json`, and only after the artefact exists.
- `.git-blame-ignore-revs` holds the oxfmt reformat commit:
  ```sh
  git config blame.ignoreRevsFile .git-blame-ignore-revs
  ```
