# @capuchoo/updater

The app-side runtime for [Capuchoo](https://github.com/aybinv7/capuchoo): it asks your update server
what to do, downloads OTA bundles or native binaries, and drives the install. Built on
`@capgo/capacitor-updater`.

```sh
npx @capuchoo/cli setup
```

That installs this package, the `@capgo/capacitor-updater` plugin it drives and `@capacitor/app`
into your app - they must be the _app's_ own dependencies for `cap sync` to wire up their native
halves - and then runs `cap sync`. Add `--native` if the app installs APKs itself.

Required peers, if you would rather add them yourself: `@capacitor/core`, `@capacitor/app`,
`@capgo/capacitor-updater`. Optional: `@capacitor/device` (reports OS version and emulator flag),
`vue` (only for the `/vue` entry point), `@capacitor/preferences` (remembers a runtime channel
natively; `localStorage` otherwise), and `@capacitor/filesystem`, `@capacitor/network`,
`@capacitor/file-transfer`, `@capawesome-team/capacitor-file-opener` - loaded on demand, and only by
the native-APK path. With `@capacitor/network` installed the updater also re-checks when the device
comes back online.

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

### 2. Configure the plugin through `capuchooUpdaterConfig()`

```ts
// capacitor.config.ts
import { capuchooUpdaterConfig } from "@capuchoo/updater/capacitor";

plugins: {
  CapacitorUpdater: capuchooUpdaterConfig({
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
`progress`, `cachedPath`, `handedToInstaller`, `installFailures`, `installAbandoned`, `error`,
`lastCheckError`, `lastCheckedAt`, `channelOverride`, `statusMessage` and `lastCheckMessage`.

Without Vue, use the services directly: `checkForUpdate()`, `downloadNativeUpdate()`,
`openNativeInstaller()`, `applyOtaUpdate()`, `getCurrentBundle()`, `discardBundle()`.

### The native install, when Android says no

The installer reports nothing back. When the app returns to the foreground after an APK was handed
over, the updater reads the installed build number: installed means done; not installed returns the
prompt to "downloaded - install again" (a required update still requires it, but Install is always
available). After two failed installs of the same version - which is what a signing key that differs
from the installed build's looks like - `installAbandoned` is set, `error` explains it, and the gate
stops blocking. The count survives a relaunch.

Before the installer opens, the APK's SHA-256 is checked against the server's `checksum`, read in
chunks (`readFileInChunks`, else ranged `readFile`). A mismatch deletes the file. A download link
that answers 401/403/410 is renewed by a fresh check and retried once; a link older than 45 minutes
is renewed before use.

### Runtime channel

`setChannel(name)` tells the server (`POST /api/channel_self`), remembers the choice only once it
accepts, and sends it as `channel` on every check. `clearChannel()` returns to the build's default;
`getChannel()` returns whichever applies.

## Signed releases

```ts
configureUpdater({ publicKey: import.meta.env.VITE_UPDATE_PUBLIC_KEY });
```

`VITE_UPDATE_PUBLIC_KEY` (base64 SPKI or PEM) is baked into the build. With a key set, every OTA
bundle is verified before `set()` and every APK before the installer opens; an unsigned or badly
signed release is refused and reported in `error`. `requireSignature` defaults to true once a key is
set (`VITE_UPDATE_REQUIRE_SIGNATURE=false` opts out, but a signature that is present is always
checked). This key is not the Capgo plugin's `publicKey`, which is for end-to-end bundle encryption,
so it is not part of `capuchooUpdaterConfig()`.

## Errors are not "up to date"

`checkForUpdate()` throws `UpdateCheckBlockedError` when the server reports a configuration problem
— an unknown channel, or an environment mismatch between the build and the channel. Show it.
Treating every non-update response as "nothing to do" is how a broken channel goes unnoticed for
weeks.

`UpdaterConfigError` means the runtime was never configured — usually a missing `apiUrl`.

Offline, a timeout or a 5xx is not a refusal: each check is retried (`checkAttempts`, default 3,
`timeoutMs` 15 s per attempt, exponential backoff with jitter) and, if it still gets no answer, only
`lastCheckError` is set - never `error`. The updater re-checks on resume once the last check is
older than `recheckIntervalMs` (30 min), and when the network comes back.

## One request decides everything

The runtime asks `POST /api/update` and nothing else. It is the only endpoint that consults the
channel's assigned native version _and_ an OTA bundle's `min_update_version` gate, and it sends the
real current bundle version rather than a constant. A required native update outranks OTA; an
optional one arrives as `currentUpdate.nativeOffer` alongside the bundle it no longer hides.

## Stability

Pre-1.0: the surface may change between minor versions.
