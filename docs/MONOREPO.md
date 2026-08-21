# The monorepo

How this workspace is put together, and why each decision was made the way it was. If you are
looking for what was wrong with the five separate repositories, read [AUDIT.md](./AUDIT.md).

## Layout

```
capucho/
├── packages/
│   ├── core/           @capuchoo/core          contract shared by everything
│   ├── updater/        @capuchoo/updater       app-side runtime
│   ├── cli/            capucho-cli            build and publish releases
│   └── apps-manager/   capucho-apps-manager   Capacitor plugin, device app info
├── apps/
│   ├── dashboard/      @capucho/dashboard     orgs, apps, channels, releases
│   └── template/       @capucho/template      reference Capacitor application
├── services/
│   └── back/           @capucho/back          update server
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

This matters most for Capacitor. `@capuchoo/updater`, `capucho-apps-manager` and the apps must agree
_exactly_, or the native bridge loads two copies of the runtime and plugin calls resolve against the
wrong one. `catalogMode: prefer` means a package that forgets `catalog:` still lands on the pinned
version.

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

1. `mkdir packages/<name>` with a `package.json` named `@capucho/<name>`.
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

| Package                 | Checked by      |
| ----------------------- | --------------- |
| core, updater           | `vp pack --dts` |
| cli, back, apps-manager | `tsc`           |
| dashboard, template     | `vue-tsc`       |

All of them run inside `vp run -r build`, so a type error fails the build.

oxlint's own tsc diagnostics are **off** (`lint.options.typeCheck: false`). Its type checker cannot
resolve `.vue` single-file components - that needs Volar - so enabling it produced ~180 phantom
"Cannot find module './Foo.vue'" errors and drowned every real finding. Type-aware lint _rules_ stay
on.

## Releasing

**The CLI** - tag `cli-v<version>` matching `packages/cli/package.json`. The workflow verifies they
agree, builds, tests, and publishes to npm with provenance. Nothing writes back to the repository.

**An app** - run the `deploy-app` workflow, or `capucho deploy ota` locally. Both take the same path
through the CLI. Git owns tags and history; Capucho owns channels, activation and rollback.

`@capuchoo/core` and `@capuchoo/updater` are not published yet. Apps in this workspace consume them
through `workspace:*`. Publishing them needs the `@capucho` npm scope; until then an external app
links them by path, as Lowmaro does.

## Working on an app that depends on a library

The apps import `@capuchoo/updater` from its `dist`, so build the libraries first:

```sh
vp run libs
vp -C apps/template dev
```

Or run `vp pack --watch` in `packages/updater` alongside the app's dev server.

## The old repositories

The five originals are still at `capucho/capucho-cli`, `capucho-back`, `capucho-front`,
`capucho-app` and `capucho-apps-manager`, untouched, with their GitHub remotes intact. Nothing here
writes to them.

Their full history came across via `git subtree`, so this repository has six roots and every past
commit is reachable:

```sh
git log --oneline --graph        # 71 commits, 5 merged histories
git log <old-sha>               # any pre-migration commit
```

`git log --follow` will not cross the subtree merge for a moved file - that is inherent to subtree
imports. Use `git log --all -- '*<filename>'`, or read the file's history in the original
repository.

Once you are satisfied, the originals can go:

```sh
cd C:/Users/aybin/code/ayb/capucho
rm -rf capucho-cli capucho-back capucho-front capucho-app capucho-apps-manager
```

They are outside this repository's `pnpm-workspace.yaml`, so they are inert until then - they just
cost disk.

Lowmaro still links the old CLI:

```json
"capucho-cli": "link:../capucho/capucho-cli"
```

Point it at `link:../capucho/capucho/packages/cli` to pick up the rewritten one. Its own updater is
a copy of the code that became `@capuchoo/updater`; it can switch to the package when convenient.

## Conventions

- Code, comments, commit messages and PR descriptions in English.
- `.capucho/project.json` is committed - it identifies the app and is not a secret.
  `.capucho/config.json` holds the API key and is git-ignored.
- `build/<env>/.env.<env>` files are committed on purpose: they hold public build configuration (app
  id, display name, update endpoint, channel) that Trapeze and Vite both read. Real secrets go in
  `.env.local`, which is ignored.
- The CLI never writes to an env file. A deploy modifies exactly one tracked file,
  `version-code.json`, and only after the artefact exists.
- `.git-blame-ignore-revs` holds the oxfmt reformat commit:
  ```sh
  git config blame.ignoreRevsFile .git-blame-ignore-revs
  ```
