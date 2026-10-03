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

Devices fetch the policy with the `version` they have and get `{ unchanged }` when nothing moved. In
the foreground a device asks with `wait` (`listenMs`, at most 55 s, under the idle timeout of most
proxies) and the server holds the request until a rule for the app changes or a live deadline
passes, so going live reaches the device in about 300 ms. In the background, or when a server
answers a held request in under two seconds, the device falls back to polling every `pollMs`.

Each policy request carries the recorder's own health (worker or not, OPFS or memory, each database
source's state, dropped segments, last error). The server keeps the latest per device, writing only
when it changed or every five minutes, and **Recordings → Connect an app** shows it live.

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
- **A session starts from a snapshot.** When a session begins uploading (or a buffer is promoted)
  the watched tables are read through the app's `execute` in 250-row pages with a pause between
  them, up to `database.snapshotRows` rows per table. The dashboard rebuilds any moment from that
  starting state forward, and further back through the old values each change carries.
- **Without the session extension,** `sqlChangesSource` installs TEMP triggers on the app's own
  connection that log each written row as JSON into a TEMP table, drained when the change bus says
  something was written (every 2 s without a bus). Values are captured on every SQLite engine.
- **A database source waits for its `ready` promise,** never the recorder. Start the recorder before
  the database opens: a boot that fails to open it is then recorded, with a `database-unavailable`
  marker carrying the reason.
- **`start()` is idempotent,** and the app id falls back to the native bundle identifier when
  `VITE_APP_ID` is not set, because that is what the server matches.

## Integrating an app

**Recordings → Connect an app** in the dashboard is the guided version of this section: the snippets
for the app's database engine, and a live check of what each device's recorder reports.

```ts
// src/shared/recording/recorder.worker.ts
import { runRecorderWorker } from "@capuchoo/recorder/worker";
runRecorderWorker();
```

```ts
// src/plugins/recorder.plugin.ts
import { changesetSource, createRecorder, sqlChangesSource } from "@capuchoo/recorder";
import { updaterIdentity } from "@capuchoo/recorder/updater";
import RecorderWorker from "@/shared/recording/recorder.worker?worker";

export const recorder = createRecorder({
  identity: updaterIdentity(),
  worker: () => new RecorderWorker(),
  databases: [
    changesetSource(changeCapture, {
      name: "app",
      execute,
      ready: openDatabase,
      fallback: sqlChangesSource({ name: "app", execute, bus: changeBus }),
    }),
  ],
  onShake: () => askForNoteThen((note) => recorder.report({ note })),
});
```

`execute(sql, params)` runs one statement on the app's connection and returns rows as objects; it is
what snapshots and the trigger fallback use. Pass the same `changeCapture` to
`createOpfsDialect({ ..., capture: changeCapture })`. Call `recorder.start()` in `main.ts` before
the database opens. A router that keeps its own stack (Framework7) marks navigation with
`recorder.mark("route", { url })`. `recorder.telemetry` takes events, spans and measures, and
`recorder.telemetry.adapter` plugs into `@sig/telemetry` as one of its adapters.

Elements marked `data-capuchoo-mask` have their text masked, `data-capuchoo-block` are recorded as
empty boxes, `data-capuchoo-ignore` inputs are not recorded. Network `traceparent` propagation is
opt-in per URL (`network.propagateTrace`), because a server that does not allow the header fails its
CORS preflight.

## Source maps

Build with `build.sourcemap: "hidden"`: Vite writes a `.map` beside each chunk without pointing the
chunk at it. `capuchoo deploy ota` keeps every `.map` out of the archive, so none reaches a device,
and after the bundle is accepted stores each one for the release's version
(`PUT /api/apps/:id/source-maps?version=&path=`; a map that fails to store is a deploy warning, not
a failed release). The player reads a recorded stack through them: the frame in the app's own source
file and line, the code around it from the map's embedded sources, library frames folded, and the
minified stack one click away. Only the maps a stack points at are fetched, and the decoder is
loaded the first time a stack is opened.

Maps are kept while any recording still runs their version, and purged with recordings after that.
`capuchoo deploy native` does the same for the bundle compiled into the binary: it deletes the maps
`cap sync` copied into `app/src/main/assets/public` before Gradle runs (the app's own build output
keeps them) and stores them for the native version.

## Errors

The recorder fingerprints each error it records: the message without its numbers, ids and urls, plus
the script of the top frame without its build hash, so one bug keeps a single group across sessions,
devices and builds. Up to five distinct errors per segment travel in the segment's metadata with
their count and first time. The server counts them into `recording_issues` in the same transaction
that records the segment, so a retried upload counts nothing twice; it still never opens a segment.

**Recordings → Errors** lists them with their events, devices, versions and the top frame read
through source maps, each opening onto the sessions it happened in and a replay link a moment before
it. Resolving hides an error; a device hitting it again marks it regressed. Errors no device has hit
within the recording retention are purged.

## The player

The screen, an inspector (activity, console, network, database, telemetry, performance) and a
timeline with a lane per track and markers for errors, failed requests, rage taps and reports.

- **Data view:** each table as a grid at the playhead - inserted rows green, updated rows amber with
  the changed cells marked and their previous value on hover, deleted rows red - with a change log
  that seeks. It opens on the table the session wrote to most.
- **Taps** ripple on the replay; three within 800 ms and 40 px are a rage tap.
- **Keys:** Space plays, ←/→ step 5 s (Shift 30 s), N/P jump between issues, S/D/B pick screen, data
  or both, F follows a live session.
- **Share:** a link that opens the replay at the current moment (`?t=`), or a Markdown bug report
  with the device, build, note and every issue linked to its moment.

## Operations

- `RECORDING_RETENTION_DAYS` (default 14) bounds sessions; rows and blobs go together, and assets of
  versions no session refers to go with them.
- The recording endpoints carry their own CORS (`x-capuchoo-recording`, `x-capuchoo-asset`) and
  their own rate limits; a segment is at most 2 MiB, an asset 4 MiB.
- Capacity per process is in [CAPACITY.md](./CAPACITY.md).
- On the Render deploy storage is PostgreSQL, so recordings take database space; prefer S3 or the
  filesystem driver before turning recording on for a fleet.
