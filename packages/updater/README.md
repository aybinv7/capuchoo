# @capuchoo/updater

The app-side runtime for [Capuchooo](https://github.com/aybinv7/capucho): it asks your update server
what to do, downloads OTA bundles or native binaries, and drives the install. Built on
`@capgo/capacitor-updater`.

```sh
npm install @capuchoo/updater @capuchoo/core
```

Peers you will already have in a Capacitor app: `@capacitor/core`, `@capacitor/app`,
`@capacitor/filesystem`, `@capacitor/network`, `@capacitor/file-transfer`,
`@capawesome-team/capacitor-file-opener`, `@capgo/capacitor-updater`. `vue` is optional and only
needed for the `/vue` entry point.

## Three things, in order

### 1. Call `notifyAppReady()` first

```ts
// src/main.ts
import { notifyAppReady } from "@capuchoo/updater";

void notifyAppReady();
```

Early, and unconditionally. It confirms that the bundle **currently running** booted. If the plugin
does not hear it within `appReadyTimeout` (10 s), it concludes the bundle crashed and rolls back to
the previous one — so gating this call behind a condition, or awaiting a network request before it,
reverts working updates. It is not a gate on auto-update.

### 2. Configure the plugin through `capuchoUpdaterConfig()`

```ts
// capacitor.config.ts
import { capuchoUpdaterConfig } from "@capuchoo/updater/capacitor";

plugins: {
  CapacitorUpdater: capuchoUpdaterConfig({
    apiUrl: process.env.VITE_UPDATE_API_URL,
    channel: process.env.VITE_UPDATE_CHANNEL,
  }),
}
```

This returns `autoUpdate: "onlyDownload"`, because the app drives the install itself — with
`autoUpdate: true` the plugin and your UI both apply bundles, and a device can download the same
bundle twice or reload mid-prompt. It also **throws on an empty `apiUrl`** rather than accepting
one: an empty update URL does not fail at runtime, it silently disables updates, which ships a build
that never checks.

### 3. Drive it from your UI

```ts
import { useUpdater } from "@capuchoo/updater/vue";

const updater = useUpdater();
await updater.init();
```

`UpdaterState` exposes `checking`, `downloading`, `installing`, `updateAvailable`, `currentUpdate`,
`progress`, `cachedPath`, `error`, `statusMessage` and `lastCheckMessage`.

Without Vue, use the services directly: `checkForUpdate()`, `downloadNativeUpdate()`,
`openNativeInstaller()`, `applyOtaUpdate()`, `getCurrentBundle()`, `discardBundle()`.

## Errors are not "up to date"

`checkForUpdate()` throws `UpdateCheckBlockedError` when the server reports a configuration problem
— an unknown channel, or an environment mismatch between the build and the channel. Show it.
Treating every non-update response as "nothing to do" is how a broken channel goes unnoticed for
weeks.

`UpdaterConfigError` means the runtime was never configured — usually a missing `apiUrl`.

## One request decides everything

The runtime asks `POST /api/update` and nothing else. It is the only endpoint that consults the
channel's assigned native version _and_ an OTA bundle's `min_update_version` gate, and it sends the
real current bundle version rather than a constant. Native updates outrank OTA, because the server
can legitimately return both.

## Stability

Pre-1.0: the surface may change between minor versions.
