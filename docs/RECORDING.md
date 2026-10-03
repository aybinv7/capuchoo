# Session recording

What a device did, on one timeline: the screen (rrweb), console and uncaught errors, network,
performance, the app's own telemetry, and every committed SQLite write with its row values. The
server decides what each device records; the device does the work off the thread the app renders on.

## The pieces

| Piece                                                     | Role                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `packages/core/src/recording-policy.ts`                   | Policy layers, defaults, limits, `resolveRecordingPolicy`    |
| `packages/core/src/recording-wire.ts`                     | Session and segment metadata, the header codec, validation   |
| `packages/recorder` (`@capuchoo/recorder`)                | Tracks on the main thread, the pipeline in a worker          |
| `@cavulsqa/mobile-db` `createChangeCapture()`             | SQLite session extension inside the OPFS worker → changesets |
| `services/server` routes `recording-device`, `recordings` | Ingest, storage, rules, playback                             |
| `apps/dashboard/src/modules/recordings`                   | Sessions list, player with synced lanes, rules editor        |

## Modes

`off` → `buffer` → `session` → `live`, in that order of cost.

- **buffer** keeps the last `buffer.maxMs` / `buffer.maxBytes` on the device and uploads nothing.
- **session** uploads every `flushMs`.
- **live** uploads every `liveFlushMs` and beats every 5 s so a viewer can tell idle from gone.

A trigger (`shake`, `error`, `manual` report, `app` code) raises the device to a session for
`postRollMs`, never above `ceiling`. Raising from buffer keeps the buffer: the session starts at the
oldest segment still on the device, so it shows what led up to the trigger. When the post-roll ends
the device goes back to its baseline in a new session.

## Rules

Stored per app, per channel and per device; resolved in that order over `DEFAULT_RECORDING_POLICY`
(mode `off`). Every field of a stored patch is clamped on read to `RECORDING_LIMITS`, so a bad row
cannot ask a phone to flush every millisecond. A device rule with `live_until` forces live until
then. `sampleRate` picks a stable bucket per device id; a device with its own rule is always
sampled.

Devices fetch the policy with the `version` they have and get `{ unchanged }` when nothing moved.
They ask on start, every `pollMs`, and on return to the foreground; going live waits for that check.

## Invariants that bite

- **Nothing is serialized on the main thread.** Tracks push plain objects; the collector hands a
  batch to the worker in one structured clone per idle period. JSON, gzip (native
  `CompressionStream`, fflate only where it is missing), OPFS writes and uploads happen in the
  worker. The app must give the recorder a worker (`worker: () => new RecorderWorker()`); without
  one the same pipeline runs inline from memory.
- **Segments are written before they are uploaded,** through OPFS synchronous access handles, so a
  crash loses at most the open segment. On the next start, promoted sessions resume uploading and a
  buffer that held errors is uploaded as an `error` session; a clean buffer is discarded.
- **Eviction drops whole replay groups,** from one full snapshot to the next, so whatever survives
  starts where playback can begin. The newest group always survives.
- **Stylesheets and images are recorded by reference** (`inlineStylesheet: false`) and uploaded once
  per app version and path. A full snapshot no longer carries the app's CSS, which is most of its
  size and most of rrweb's main-thread cost. The dashboard rewrites references to the server's copy,
  and serves rewritten stylesheets from blob URLs, so asset URLs must be absolute.
- **The server never opens a segment.** The body is stored as posted (gzip) and served back with
  `content-encoding: gzip`, so the dashboard's browser inflates it.
- **A segment is recorded once per `seq`;** a retried upload changes nothing. A segment for a
  session another device started is refused. A note that arrives on a later segment fills an empty
  one.
- **The recorder knows no database engine.** `changesetSource` and `changeBusSource` fit cavulsqa's
  capture and change bus structurally; anything else implements `DatabaseSource`. Changesets are
  SQLite's own binary format, decoded in the dashboard in TypeScript against the schema the device
  announced.
- **The session extension ignores tables without a PRIMARY KEY,** and a rolled-back transaction is
  discarded through the rollback hook.

## Integrating an app

```ts
// src/shared/recording/recorder.worker.ts
import { runRecorderWorker } from "@capuchoo/recorder/worker";
runRecorderWorker();
```

```ts
// src/plugins/recorder.plugin.ts
import { changeBusSource, changesetSource, createRecorder } from "@capuchoo/recorder";
import { updaterIdentity } from "@capuchoo/recorder/updater";
import RecorderWorker from "@/shared/recording/recorder.worker?worker";

export const recorder = createRecorder({
  identity: updaterIdentity(),
  worker: () => new RecorderWorker(),
  databases: [
    changesetSource(changeCapture, {
      name: "app",
      fallback: changeBusSource(changeBus, { name: "app" }),
    }),
  ],
  onShake: () => askForNoteThen((note) => recorder.report({ note })),
});
await recorder.start();
```

Pass the same `changeCapture` to `createOpfsDialect({ ..., capture: changeCapture })`. A router that
keeps its own stack (Framework7) marks navigation with `recorder.mark("route", { url })`.
`recorder.telemetry` takes events, spans and measures, and `recorder.telemetry.adapter` plugs into
`@sig/telemetry` as one of its adapters.

Elements marked `data-capuchoo-mask` have their text masked, `data-capuchoo-block` are recorded as
empty boxes, `data-capuchoo-ignore` inputs are not recorded. Network `traceparent` propagation is
opt-in per URL (`network.propagateTrace`), because a server that does not allow the header fails its
CORS preflight.

## Operations

- `RECORDING_RETENTION_DAYS` (default 14) bounds sessions; rows and blobs go together, and assets of
  versions no session refers to go with them.
- The recording endpoints carry their own CORS (`x-capuchoo-recording`, `x-capuchoo-asset`) and
  their own rate limits; a segment is at most 2 MiB, an asset 4 MiB.
- On the Render deploy storage is PostgreSQL, so recordings take database space; prefer S3 or the
  filesystem driver before turning recording on for a fleet.
