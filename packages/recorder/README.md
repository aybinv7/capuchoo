# @capuchoo/recorder

Session recording for Capacitor apps, streamed to a Capuchoo server: the screen (rrweb), console and
uncaught errors, network, performance, the app's own telemetry, and committed SQLite writes with
their row values. What each device records is decided on the server; serialization, compression,
storage and upload run in a worker.

```ts
import { createRecorder } from "@capuchoo/recorder";
import { updaterIdentity } from "@capuchoo/recorder/updater";
import RecorderWorker from "./recorder.worker?worker";

const recorder = createRecorder({
  identity: updaterIdentity(),
  worker: () => new RecorderWorker(),
});
await recorder.start();
```

```ts
// recorder.worker.ts
import { runRecorderWorker } from "@capuchoo/recorder/worker";
runRecorderWorker();
```

- `recorder.trigger(kind, { note })`, `recorder.escalate(mode, { durationMs })`,
  `recorder.report({ note })` raise recording within the server's ceiling.
- `recorder.mark(name, data)` puts a marker on the timeline.
- `recorder.telemetry.event / span / measure / error`, and `recorder.telemetry.adapter` for
  `@sig/telemetry`.
- `databases: [changesetSource(capture, { name, fallback })]` records SQLite changesets from
  `@cavulsqa/mobile-db`; `changeBusSource(bus, { name })` records which table changed.

The design, the modes and the invariants are in the repository's `docs/RECORDING.md`.
