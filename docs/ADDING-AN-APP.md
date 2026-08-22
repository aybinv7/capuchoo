# Adding an existing app

What it takes to put an app you already have onto Capuchoo. Roughly fifteen minutes, most of it
waiting for a build.

The shape of it: the **cloud** needs to know the app exists and which channels it has, the **app**
needs to ask for updates, and the **repository** needs enough configuration for the CLI to build
each flavour. Miss any one and the other two look fine while nothing reaches a device.

Run `capuchoo doctor` at any point. It checks all of this and names the fix for whatever is missing.

## 1. Install

```sh
npx @capuchoo/cli setup
```

One command: it adds `@capuchoo/updater`, the `@capgo/capacitor-updater` plugin it drives,
`@capacitor/app` and `@capacitor/device` to your app, adds `@capuchoo/cli` as a dev dependency, and
runs `npx cap sync`. It prints what it will add first, skips whatever you already have, and
`--dry-run` reports without changing anything.

Add `--native` if the app downloads and installs an APK itself. That needs four more plugins -
`@capacitor/file-transfer`, `@capacitor/filesystem`, `@capacitor/network`,
`@capawesome-team/capacitor-file-opener` - and OTA web-bundle updates do not use any of them, so
they are left out by default. The updater loads them on demand and, if one is missing, says which.

Why a command rather than a list to copy: these have to be the **application's** dependencies.
`cap sync` finds plugins by reading the app's `dependencies` and `devDependencies` - the
`getDependencies()` it uses does not recurse - so a plugin the updater pulled in transitively would
have its JavaScript installed and its native half never added to the Android or iOS project. It
would look installed and fail on a device. `@capuchoo/core` is deliberately not in the list: the
updater depends on it and re-exports the types an app needs.

## 2. Sign in and link

```sh
capuchoo auth login          # stores the API key in ~/.capuchoo/config.json
capuchoo init                # writes .capuchoo/project.json
```

`init` asks whether to link an existing cloud app or create one, detects the flavour files you
already have, and reads `webDir` out of `capacitor.config.*`. Commit `.capuchoo/project.json` - it
identifies the app and holds no secrets.

## 3. Create channels, and set each one's environment

In the dashboard: **Channels > New**. A channel needs a name and an **environment** (`prod`,
`staging`, `dev`).

The environment is not decoration. It decides which `.env` flavour the CLI builds and which bundles
the server serves. A channel _named_ `prod` sitting on the `staging` environment serves staging
bundles to production devices, and nothing errors. `capuchoo doctor` warns when a name and an
environment disagree.

## 4. One env file per flavour

The CLI reads `build/<env>/.env.<env>` by default - override the paths in `.capuchoo/project.json`
if your layout differs.

```ini
# build/staging/.env.staging
VITE_APP_ID=com.company.app
VITE_APP_NAME=Your App
VITE_ENVIRONMENT=staging
VITE_UPDATE_CHANNEL=staging
VITE_UPDATE_API_URL=https://your-backend.example.com
```

Three rules:

- **The version does not live here.** `package.json`'s `version` is the source of truth and
  `version-code.json` holds the per-environment build numbers; the CLI computes `VITE_APP_VERSION`,
  `VERSION_CODE` and `BUILD_NUMBER` for each deploy and passes them to the build itself. Setting
  them in this file has no effect - the computed values win - so a version written here will look
  authoritative and be ignored. Use `capuchoo version bump` instead.

- **`VITE_UPDATE_API_URL` must not be empty.** An empty update URL does not fail - it silently
  disables updates, shipping a build that never checks. `capuchooUpdaterConfig()` throws on it
  rather than let that happen.
- **Nothing writes to these files.** The CLI passes build values as environment variables;
  `version-code.json` is the only tracked file a deploy touches.

## 5. Wire the app

Three edits. The first one matters more than it looks.

```ts
// src/main.ts - first statement, before anything that can block
import { notifyAppReady } from "@capuchoo/updater";

void notifyAppReady();
```

`notifyAppReady()` confirms that the bundle **currently running** booted. If the plugin does not
hear it within `appReadyTimeout` (10s) it concludes the bundle crashed and rolls back. Gating it
behind a condition, or awaiting a network call first, therefore reverts updates that installed
perfectly.

```ts
// capacitor.config.ts
import { capuchooUpdaterConfig } from "@capuchoo/updater/capacitor";

export default {
  plugins: {
    CapacitorUpdater: capuchooUpdaterConfig({
      apiUrl: process.env.VITE_UPDATE_API_URL,
      channel: process.env.VITE_UPDATE_CHANNEL,
    }),
  },
};
```

This returns `autoUpdate: "onlyDownload"`, because the app decides when to apply. With
`autoUpdate: true` the plugin and your UI both apply bundles and a device can download the same one
twice.

```vue
<!-- wherever you want the update UI -->
<script setup lang="ts">
import { useUpdater } from "@capuchoo/updater/vue";

const updater = useUpdater();
await updater.init();
</script>
```

`useUpdater()` exposes `checking`, `downloading`, `installing`, `updateAvailable`, `currentUpdate`,
`progress`, `error`, `statusMessage` and `lastCheckMessage`, plus `check()`, `startDownload()` and
`installNativeUpdate()`. Without Vue, call the services directly - `checkForUpdate()`,
`downloadNativeUpdate()`, `applyOtaUpdate()`.

Show configuration failures. `checkForUpdate()` throws `UpdateCheckBlockedError` for an unknown
channel or an environment mismatch; treating that as "you are up to date" is how a broken channel
goes unnoticed for weeks.

## 6. Native signing, for `deploy native --type release`

Android needs a real `signingConfig` in `android/app/build.gradle`, driven by
`CAPUCHOO_KEYSTORE_PATH`, `CAPUCHOO_KEYSTORE_PASSWORD`, `CAPUCHOO_KEY_ALIAS`,
`CAPUCHOO_KEY_PASSWORD`. Gradle will happily produce `app-release-unsigned.apk` without one, and
Android will refuse to install it - so the CLI inspects the artefact and will not publish an
unsigned release unless you pass `--allow-unsigned`.

OTA deploys need none of this.

## 7. Deploy

```sh
capuchoo doctor                                   # confirm all of the above
capuchoo deploy ota --channel staging --dry-run   # builds and packages, uploads nothing
capuchoo deploy ota --channel staging
```

Then check it is actually being served - the step people skip:

```sh
capuchoo channel list      # the channel should show a current version
```

A successful upload and a served bundle are different things. `active` on a version means the
artefact _may_ be served; the channel's pointer decides which one is.

## What is optional

- **Trapeze.** If installed with a config per flavour, the CLI runs it and the YAML stays
  authoritative. Otherwise the CLI writes the identity and version into `build.gradle`,
  `strings.xml` and `Info.plist` itself, and reports which path it took.
- **`@capacitor/assets`.** Icon and splash generation is skipped, with an explanation, when the
  package or the source artwork is missing.
- **A particular package manager or script names.** The CLI resolves executables from
  `node_modules/.bin` upwards and never depends on your `package.json` scripts.
