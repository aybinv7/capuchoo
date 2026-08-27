# The Capgo plugin, as it actually behaves

Capuchoo does not implement its own native update engine. It drives
[`@capgo/capacitor-updater`](https://github.com/Cap-go/capacitor-updater), reimplements the backend
that plugin talks to, and adds native (APK) delivery on top — which Capgo's own service does not do
for self-hosted binaries.

That makes the plugin's expectations our specification, and every serious bug this project has
shipped came from guessing at them. This file is what we know, why we know it, and how to check it
again.

**Nothing here is from a website.** Every claim is read out of the installed package and cited to a
file and line, because the docs site describes Capgo's hosted service and the plugin's own README
describes the latest `main`, neither of which is necessarily the version an app has installed.

## Where the source is

Capacitor plugins ship their native implementation inside the npm package, so the authority is
already on disk in any app that installs it. Nothing needs cloning.

```
node_modules/@capgo/capacitor-updater/
  dist/docs.json                                     generated TS API, config and event surface
  dist/esm/definitions.d.ts                          the typed contract
  android/src/main/java/ee/forgr/capacitor_updater/
    CapacitorUpdaterPlugin.java                      5561 lines: config, autoUpdate loop, events
    CapgoUpdater.java                                2476 lines: HTTP, download, bundle storage
  ios/Sources/                                       the same engine for iOS
```

`dist/docs.json` is machine-readable and is the fastest way to answer "what does this version
accept":

```bash
node -e "const d=require('./node_modules/@capgo/capacitor-updater/dist/docs.json');
console.log(d.pluginConfigs[0].properties.map(p=>p.name+': '+p.type).join('\n'))"
```

Everything below was read from **7.50.2**, which is what `capuchoo setup` installs for a Capacitor 7
app. Line numbers are from that version; re-check them after an upgrade — see
[Re-checking after an upgrade](#re-checking-after-an-upgrade).

## The update-check contract

This is the part that matters, and the part we got wrong for months.

With any `autoUpdate` mode other than `false`/`"off"`, **the plugin runs its own background check
against `updateUrl`**, entirely separately from whatever the app's own code does. Our runtime calls
`POST /api/update` itself and drives the UI from the answer; the plugin calls the _same endpoint_ on
its own schedule and acts on the answer independently. Both are live at once. A response that our
runtime reads perfectly can still be a failure from the plugin's side, and that failure is what
surfaces to the user.

### How the plugin reads a response

`CapacitorUpdaterPlugin.java`, in the `getLatest` callback:

| Step                                                                          | Line   | Behaviour                                                                                                                       |
| ----------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `if (jsRes.has("error") \|\| jsRes.has("kind"))`                              | 4515   | Enters the **classification** branch and never looks for a bundle again.                                                        |
| `normalizedUpdateResponseKind(kind)`                                          | 4333–7 | Anything not `up_to_date`, `blocked` or `failed` becomes **`"failed"`** — including absent.                                     |
| `"failed".equals(kind)` → `endBackGroundTaskWithNotif(..., "downloadFailed")` | 4537   | Raises `downloadFailed` to the app.                                                                                             |
| `jsRes.getString("version")`                                                  | 4551   | **Unconditional** once unclassified. A missing key throws, is caught as "error in update check", and the response is discarded. |
| `!jsRes.has("url") \|\| !isValidURL(...)`                                     | 4609   | No URL, or a malformed one, ends the check as a failure.                                                                        |

`CapgoUpdater.makeJsonRequest` (line 1621) applies the same `error`/`kind` rule before the plugin
ever sees the body, and copies every other key through verbatim — so extra fields are harmless, and
`session_key` is remapped to `sessionKey` (line 1678).

### The three rules that follow

1. **A response carrying a bundle must not set `kind` or `error`.** Either one routes it into
   classification, and it is never downloaded.
2. **A response carrying no bundle must set `kind`.** Absent means `"failed"`, which raises
   `downloadFailed` — this is where "the update could not be downloaded" came from on a device that
   was simply up to date.
3. **`version` must be sent wherever a version is known.** The plugin reads `version`, not
   `version_name`.

Before these were followed, **every background check the plugin made against this backend failed** —
on a good bundle, on an up-to-date device, on everything — because the backend sent only
`version_name` and never sent `kind`. Our own runtime never noticed, because it parses the response
itself.

They are enforced in `packages/core/src/update-decision.test.ts`, asserted across every outcome
rather than case by case, so a new decision cannot break them quietly.

### What the plugin sends

From `CapgoUpdater.java` lines 1971-1987, which builds the body for every check the plugin makes on
its own. Worth reading before designing anything server-side around a field you assume is there.

| Field            | Meaning                                                           |
| ---------------- | ----------------------------------------------------------------- |
| `platform`       | Hardcoded `"android"` in the Android source.                      |
| `device_id`      | The plugin's own device UUID.                                     |
| `app_id`         | The bundle identifier compiled into the binary.                   |
| `custom_id`      | Free field the app can set. Unused by us.                         |
| `version_build`  | Native `versionName`.                                             |
| `version_code`   | Native `versionCode`.                                             |
| `version_os`     | OS version.                                                       |
| `version_name`   | **Applied bundle** version, or `builtin`. Not the native version. |
| `plugin_version` | Plugin version.                                                   |
| `is_emulator`    | Whether it is running on an emulator.                             |
| `is_prod`        | **False for a debuggable build.**                                 |
| `install_source` | Play Store, sideload, and so on.                                  |
| `defaultChannel` | The baked-in channel. **Not `channel`** — see below.              |
| `key_id`         | Only when a decryption key is cached.                             |

Two of these are load-bearing and were unread for months:

- **`defaultChannel`, not `channel`.** The plugin never sends a key called `channel`; our own
  runtime does. `updateService` accepts `channel`, then `defaultChannel`, then `default_channel`, so
  both callers resolve — but a server reading only `channel` would put every plugin-initiated check
  on the fallback channel, which is a hard failure to notice because our runtime's checks look
  correct.
- **`is_prod` and `is_emulator` are the honest way to identify a build.** They come from the binary,
  not from the spelling of its identifier, and they are what `allow_dev` and `allow_emulator` gate
  on. A device on an older plugin may send neither, so absent must not be read as false.

### The response fields the plugin declares

From `LatestVersion` in `dist/docs.json`. Fields Capuchoo sends are marked.

| Field        | Sent | Meaning                                                                          |
| ------------ | ---- | -------------------------------------------------------------------------------- |
| `version`    | yes  | Version of the offered bundle. Read unconditionally (line 4551).                 |
| `url`        | yes  | Bundle download URL. **A zip, never an APK** — see below.                        |
| `checksum`   | yes  | Integrity check for the downloaded bundle.                                       |
| `sessionKey` | yes  | Decryption key when end-to-end encryption is on. Also accepted as `session_key`. |
| `kind`       | yes  | `up_to_date` \| `blocked` \| `failed`. Required when no bundle is offered.       |
| `message`    | yes  | Free text, surfaced in logs and the `updateCheckResult` event.                   |
| `error`      | yes  | Error code. Presence alone routes the response into classification.              |
| `manifest`   | no   | Per-file list for delta downloads. We ship whole bundles.                        |
| `breaking`   | no   | Flags the update as breaking; drives `breakingAvailable`.                        |
| `major`      | no   | Legacy form of the above; drives `majorAvailable`.                               |
| `old`        | no   | The version being replaced, for reference.                                       |
| `link`       | no   | Release notes URL.                                                               |
| `comment`    | no   | Free-text description of the bundle.                                             |
| `statusCode` | n/a  | Filled in by the plugin, not the server.                                         |

`native_update`, `required`, `release_notes` and `config` are **ours**, not the plugin's. The plugin
copies them through untouched and ignores them; `@capuchoo/updater` reads them.

### Why an APK must never be in `url`

With `autoUpdate: "onlyDownload"` the plugin downloads whatever is at the top-level `url` and unzips
it as a web bundle. A native APK there made it fetch 45 MB, fail to unzip, and report "the update
could not be downloaded" — while a perfectly installable update sat unread in `native_update`. Every
`curl` test passed, because `curl` downloads an APK quite happily.

A native binary is offered through `native_update` with `kind: "blocked"` and **no** `url`.

## `autoUpdate` modes

7.50.2 accepts
`boolean | 'always' | 'off' | 'atBackground' | 'atInstall' | 'onLaunch' | 'onlyDownload'`.

| Mode                                    | Plugin checks on its own | Plugin downloads | Plugin applies |
| --------------------------------------- | ------------------------ | ---------------- | -------------- |
| `false` / `"off"`                       | no                       | no               | no             |
| `"onlyDownload"`                        | yes                      | yes              | no             |
| `true` / `"always"`                     | yes                      | yes              | yes            |
| `atInstall`, `onLaunch`, `atBackground` | yes                      | yes              | at that moment |

`capuchooUpdaterConfig` (`packages/updater/src/capacitor-config.ts`) exposes two of these:

- **`mode: "manual"` → `autoUpdate: false`.** The plugin does nothing on its own. `useUpdater`
  checks, prompts, downloads and applies. Recommended for an app that shows its own prompt: it is
  the only mode where exactly one component is in charge, and the only one where a backend mistake
  cannot reach the user through a channel the app does not control.
- **`mode: "onlyDownload"` → `autoUpdate: "onlyDownload"`.** The plugin pre-downloads in the
  background and raises `updateAvailable`; the app decides when to apply. Faster to apply, but the
  plugin and the app both hit the endpoint and both can download, so the backend must satisfy the
  three rules above exactly.

`capuchooUpdaterConfig` currently defaults to `"onlyDownload"`. That is safe now that the three
rules hold, and it is what efficy runs — but if an app only ever applies updates through a prompt,
`mode: "manual"` removes a whole class of failure by removing a whole participant.

`true` is never correct alongside `useUpdater`: the plugin applies bundles on its own schedule while
the app is downloading them, so a device can reload mid-prompt or fetch the same bundle twice.

## `notifyAppReady` and rollback

`notifyAppReady()` confirms that the **currently running** bundle booted. If the plugin does not
hear it within `appReadyTimeout` (default 10 s in our config), it treats the bundle as broken and
rolls back to the previous one.

It is not a gate on auto-update, and it is not optional. Call it as the first statement of the app's
entry point, unconditionally — not inside a route guard, a store action, or an `onMounted`, all of
which can fail to run for reasons that have nothing to do with the bundle being sound.

## Events

Fifteen, from `dist/docs.json`:

```
download            downloadComplete    downloadFailed
updateAvailable     updateCheckResult   updateFailed
noNeedUpdate        set                 setNext
appReady            appReloaded         channelPrivate
majorAvailable      breakingAvailable   onFlexibleUpdateStateChange
```

`@capuchoo/updater` drives its own state from its own HTTP call rather than from these, so the
plugin's events are mostly diagnostic for us — but `downloadFailed` is the one that reaches users
when the contract above is broken, and it is worth listening for while debugging.

## What the plugin does not do

Worth stating plainly, because it is the reason this project exists.

- **It does not install APKs.** `getAppUpdateInfo`, `openAppStore`, `performImmediateUpdate`,
  `startFlexibleUpdate` and `completeFlexibleUpdate` wrap Google Play's in-app update API — they
  drive a Play Store update of a Play-published app. There is no path for a self-hosted binary.
  Capuchoo's native flow (`@capacitor/file-transfer` → `@capawesome-team/capacitor-file-opener` →
  the Android package installer) is ours.
- **It does not decide anything.** All version comparison, channel resolution, environment isolation
  and required/optional gating happen server-side. That decision is
  `packages/core/src/update-decision.ts`.
- **It does not know about organisations, apps or channels** beyond a channel name string.

## Re-checking after an upgrade

The line numbers above are 7.50.2. When `@capgo/capacitor-updater` is bumped:

```bash
# 1. Confirm the classification rule still reads both keys, and still defaults to failed.
grep -n 'has("error") || .*has("kind")' node_modules/@capgo/capacitor-updater/android/src/main/java/ee/forgr/capacitor_updater/CapacitorUpdaterPlugin.java
grep -n -A 4 'normalizedUpdateResponseKind' node_modules/@capgo/capacitor-updater/android/src/main/java/ee/forgr/capacitor_updater/CapacitorUpdaterPlugin.java

# 2. Confirm the version key has not been renamed.
grep -n 'getString("version")' node_modules/@capgo/capacitor-updater/android/src/main/java/ee/forgr/capacitor_updater/CapacitorUpdaterPlugin.java

# 3. Diff the declared response shape.
node -e "const d=require('./node_modules/@capgo/capacitor-updater/dist/docs.json');
console.log(d.interfaces.find(i=>i.name==='LatestVersion').properties.map(p=>p.name+': '+p.type).join('\n'))"
```

Then update this file and the line numbers in `update-contract.ts`. If a rule changed, the tests in
`update-decision.test.ts` are where it gets encoded — not in a service.
