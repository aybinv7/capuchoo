# Capuchoo

Over-the-air and native update delivery for Capacitor applications: a CLI that builds and publishes
releases, a runtime the app embeds, a server that decides what each device should be running, and a
dashboard to manage it.

## What is in here

| Path               | Package               | What it does                                                     |
| ------------------ | --------------------- | ---------------------------------------------------------------- |
| `packages/core`    | `@capuchoo/core`      | The update contract, shared by every other package. No deps.     |
| `packages/updater` | `@capuchoo/updater`   | App-side runtime: checks, downloads, applies, prompts.           |
| `packages/cli`     | `@capuchoo/cli`       | Builds and publishes OTA and native releases.                    |
| `apps/dashboard`   | `@capuchoo/dashboard` | Organizations, apps, channels, releases.                         |
| `apps/template`    | `@capuchoo/template`  | Reference Capacitor application, wired end to end.               |
| `services/back`    | `@capuchoo/back`      | Update server. Owns channels, artefacts and the update decision. |

## Getting started

```sh
vp install
vp run -r build
vp run -r test
```

The toolchain is [Vite+](https://viteplus.dev). `vp` is the entry point for everything - install,
build, test, lint, format. See [docs/MONOREPO.md](./docs/MONOREPO.md).

## Shipping an app

```sh
cd apps/template

capuchoo auth login                          # once, stores an API key
capuchoo init                                # links this directory to a cloud app
capuchoo config list                          # what the CLI resolved, and which tools it found

capuchoo deploy ota --channel staging         # publish a web bundle
capuchoo deploy native --channel staging      # build and publish an APK
```

The **channel decides everything else**. Each channel is bound to an environment (`dev`, `staging`,
`prod`), and that environment selects the build flavour - its env file, its Trapeze config, its
icons. There is no `--environment` flag to get wrong.

Useful flags:

- `--dry-run` builds and packages without uploading.
- `--json` emits a machine-readable result on stdout; everything human goes to stderr.
- `-v patch|minor|major` bumps the app version first.
- `-y` accepts every prompt, for CI.

In CI, set `CAPUCHOO_ENDPOINT` and `CAPUCHOO_API_KEY`. They take precedence over stored credentials
and are never written to disk.

### What a deploy actually does

```
resolve   flavour, version, build number      (validates first - nothing is touched yet)
assets    launcher icons and splash screens   (skipped if absent)
web       Vite build with the flavour's env
native    Trapeze, or the built-in patcher if Trapeze is not installed
sync      cap sync
bundle    OTA archive, or Gradle + signature check for native
upload    to Capuchoo
```

Every step is owned by the CLI. It does not call the app's `package.json` scripts, does not require
pnpm, and does not need Trapeze installed - if Trapeze is present its config stays authoritative,
and if not the CLI applies the identity and version itself and tells you what that path cannot do.

## Wiring the runtime into an app

```ts
// main.ts - first, before anything that can block.
// The OTA plugin rolls the bundle back if it does not hear this within 10s.
import { notifyAppReady } from "@capuchoo/updater";
void notifyAppReady();
```

```ts
// capacitor.config.ts
import { capuchooUpdaterConfig } from "@capuchoo/updater/capacitor";

plugins: {
  CapacitorUpdater: capuchooUpdaterConfig({
    apiUrl: process.env.VITE_UPDATE_API_URL!,
    channel: process.env.VITE_UPDATE_CHANNEL ?? "prod",
    version: packageJson.version,
  }),
}
```

```ts
// wherever Capacitor is bootstrapped
import { useUpdater } from "@capuchoo/updater/vue";
await useUpdater().init();
```

For the prompt, `useUpdatePrompt()` returns everything a dialog needs - title, body, button label,
whether it can be dismissed - so each app writes only its own markup.
`apps/template/src/shared/components/updater/UpdatePrompt.vue` is a Framework7 example.

## Documentation

- [docs/ADDING-AN-APP.md](./docs/ADDING-AN-APP.md) - putting an existing app onto Capuchoo, end to
  end.
- [docs/MONOREPO.md](./docs/MONOREPO.md) - layout, toolchain, adding a package, releasing.
- [docs/MONOREPO.md](./docs/MONOREPO.md) - layout, toolchain, the invariants that bite, and the
  known gaps.
- [packages/cli/docs/ci-releases.md](./packages/cli/docs/ci-releases.md) - CI credentials and
  release flow.

## Licence

MIT.
