# @capuchoo/recorder

Session recording for Capacitor apps, streamed to a Capuchoo server: the screen (rrweb), console and
uncaught errors, network, performance, the app's own telemetry, and committed SQLite writes with
their row values. What each device records is decided on the server; serialization, compression,
storage and upload run in a worker. The same recorder streams the screen live to a dashboard viewer
and runs Assist, where a support agent sees the app and, once the user allows it, taps and types.

## Install

```sh
pnpm add @capuchoo/recorder @capuchoo/updater
```

`@capuchoo/updater` is optional: it supplies the device's identity. Without it, pass your own
`identity` (see below).

The app must be registered on the Capuchoo server with its bundle identifier, and the dashboard's
**Recording rules** decide what a device records. Out of the box a device records nothing.

## Start

```ts
// src/recording/recorder.ts
import { createRecorder } from "@capuchoo/recorder";
import { updaterIdentity } from "@capuchoo/recorder/updater";
import RecorderWorker from "./recorder.worker?worker";

export const recorder = createRecorder({
  identity: updaterIdentity(),
  worker: () => new RecorderWorker(),
  assist: {},
});

await recorder.start();
```

```ts
// src/recording/recorder.worker.ts
import { runRecorderWorker } from "@capuchoo/recorder/worker";

runRecorderWorker();
```

`?worker` is Vite's worker import. Without `worker`, the pipeline runs on the main thread from
memory, which is fine for a trial and wrong for production.

`updaterIdentity()` reads the server URL and app id the updater is configured with
(`VITE_UPDATE_API_URL`, `VITE_UPDATE_CHANNEL`). Without the updater:

```ts
createRecorder({
  identity: async () => ({
    apiUrl: "https://capuchoo.example.com",
    appId: "com.example.app",
    deviceId: await stableDeviceId(),
    platform: "android",
    versionName: "1.4.0",
    versionCode: 140,
    channel: "production",
    device: { model: null, manufacturer: null, osVersion: null },
  }),
});
```

## Options

| Option      | What it does                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| `replay`    | Masking: `maskAllInputs`, `maskTextSelector`, `blockSelector`, `ignoreSelector`. Passwords are always masked.              |
| `network`   | `redactHeaders`, `ignore` (URLs never recorded), `propagateTrace`. Bodies are off unless a rule turns them on.             |
| `databases` | SQLite sources, see below.                                                                                                 |
| `shake`     | Shake to report. `onShake` replaces the default prompt with your own.                                                      |
| `assist`    | Turns Assist on. `texts` translates the prompts, `dir` sets their direction, `control: false` keeps the agent to pointing. |
| `logger`    | Where the recorder reports its own problems.                                                                               |

Mark elements with `data-capuchoo-mask` to hide their text, `data-capuchoo-block` to record them as
empty boxes, and `data-capuchoo-ignore` to drop the input typed into them.

## From app code

- `recorder.trigger(kind, { note })`, `recorder.escalate(mode, { durationMs })` and
  `recorder.report({ note })` raise recording, within the ceiling the server allows.
- `recorder.mark(name, data)` puts a marker on the timeline, for example on each route change.
- `recorder.telemetry.event / span / measure / error`, and `recorder.telemetry.adapter` for
  `@sig/telemetry`.

## SQLite

```ts
import { changesetSource, sqlChangesSource } from "@capuchoo/recorder";

createRecorder({
  databases: [
    changesetSource(changeCapture, {
      name: "app",
      execute,
      ready: openDatabase,
      fallback: sqlChangesSource({ name: "app", execute, bus: changeBus }),
    }),
  ],
});
```

`changesetSource` records committed changesets from `@cavulsqa/mobile-db`; `sqlChangesSource` is the
fallback that reads changed rows through your own `execute`. When an uploading session starts, each
table is read up to the rule's row limit (2,000 rows by default), 250 rows at a time in the
background; after that only changes are sent.

## Assist and live view

- Both need a socket to the server. If the app sets a Content Security Policy, allow the server's
  origin in `connect-src` for both `https:` and `wss:`.
- The user is asked before anyone sees the screen, and again before anyone controls it. A banner
  with **Stop** stays on screen the whole time; leaving the app ends the session.
- While the agent controls the app, the user's own touches are stopped and answered with a lock and
  a hint, so two hands never fight over one screen.
- Taps arrive as real pointer, touch, mouse and click events, so Framework7, Ionic and plain DOM
  handlers all react. Password fields and `maskTextSelector` fields refuse the agent's typing.

The design, the modes and the invariants are in the repository's `docs/RECORDING.md`.
