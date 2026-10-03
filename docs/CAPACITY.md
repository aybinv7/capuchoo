# Capacity

What one Capuchoo server process handles, measured, and what that means for the questions the team
asked before adopting it. Every number below was measured unless it says _estimate_.

## Short answers

| Question                                                | Answer                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1,000 devices checking and updating at the same time?   | Yes. 1,000 connections hammering `/api/update` back to back (far harsher than 1,000 people opening the app) were served at 428-508 req/s with **0 errors**; p99 3-4 s while the queue drained. 1,000 real app opens arriving within a second clear in about 2 s on one process (_estimate_ from the 450 req/s rate).     |
| 3 million requests in a delivery workday?               | Yes. 3M over 8 hours is **104 req/s**; one process held 450 req/s of the same mix with **p99 ≤ 14 ms and 0 errors**, so the average uses about 23% of one process. The 10x peak (about 1,000 req/s) needs about three processes - see [Scaling out](#scaling-out) for what that requires.                                |
| How much recording?                                     | One process stored **231-276 segments/s (7-8.5 MB/s) with nothing lost**. Real sessions measured 7-34 KiB per minute, so ingest is bound by request rate, not bytes: about 1,300 devices uploading at once in session mode per process (_estimate_ from the 5 s flush).                                                  |
| Does it hold up against the old Firebase version check? | It does more per request (channel, native minimum, flavour isolation, rollback, per-device rules, telemetry) and stays in single-digit milliseconds doing it. Firebase scales without thinking about it, but Remote Config fetches are billed from September 2026 - see [Firebase](#against-the-firebase-version-check). |

## How it was measured

- **Machine:** one laptop (Intel i7-1355U, 2 performance + 8 efficiency cores, 32 GB), Windows 11,
  Node 26, PostgreSQL 18 with default settings, the load generator on the same machine. It was
  shared with other work and an Android emulator, 55-97% busy, and repeated runs varied by up to
  ±30%. A dedicated Linux server does better; treat these as a floor.
- **Server:** one process, `NODE_ENV=production`, `DATABASE_POOL_MAX` 10 and 30, filesystem storage.
- **Load:** autocannon for closed-loop runs, a constant-arrival-rate script for the mixed profile
  (requests sent on schedule whether or not earlier ones returned, latency timed from send), 10,000
  rotating device ids for update checks, 200,000 for policy checks, real gzip segments of about 32
  KB (900 rrweb events) for ingest.

## Update checks and stats (70% / 30%)

| Offered req/s | Served | Update p50/p90/p99 ms | Stats p50/p90/p99 ms  | Errors | CPU (one core)      |
| ------------- | ------ | --------------------- | --------------------- | ------ | ------------------- |
| 104           | 104    | 3 / 3 / 5             | 4 / 6 / 249           | 0      | 21%                 |
| 250           | 250    | 3 / 4 / 7             | 4 / 7 / 11            | 0      | 55%                 |
| 400           | 400    | 3 / 6 / 9             | 5 / 9 / 13            | 0      | 67%                 |
| 450           | 450    | 3 / 6 / 10            | 4 / 10 / 14           | 0      | 70%                 |
| 500           | 303    | 507 / 35,635 / 38,907 | 494 / 35,979 / 38,905 | 23.6%  | 78%, loop saturated |

Unloaded, one request at a time: an update check is 2.6 ms at p50, a stats batch 4.0 ms.

Past about 450 req/s the event loop is saturated, and before this change the server failed badly:
requests queued for a database connection until pg-pool gave up after 10 s with a 500, connections
were refused, memory grew past 1 GB, and best-effort telemetry writes timed out. See
[Overload](#overload).

## Recording

| Endpoint                       | Per process                                                   | Notes                                                                                 |
| ------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `POST /api/recording/policy`   | 1,076-1,210 req/s at 500 connections                          | 1.2 statements per request; rules and channels come from the request cache            |
| `POST /api/recording/segments` | 231-276 segments/s, 7-8.5 MB/s                                | 0 lost: rows added equalled 201s counted in every run; about 7 statements per segment |
| Going live                     | 285 ms from the rule change to the live session on the server | the device's policy request is held open and answered when a rule changes             |

A device in the foreground asks for its policy about once a minute and holds the request open
meanwhile, so policy traffic is about 1 req/min per foreground device; one process serves tens of
thousands of them (_estimate_; held requests are open sockets, not CPU).

**Size of a recording,** from sessions recorded on the emulator: 7-9 KiB per minute for a mostly
idle screen, 23-34 KiB per minute while someone is using the app. At 30 KiB/min, 1,000 one-minute
shake reports a day are about 30 MB a day of blobs (_estimate_). Buffer mode uploads nothing until a
trigger, so a fleet in buffer costs policy checks only.

## Storage growth

| What                  | Measured cost                                                                   |
| --------------------- | ------------------------------------------------------------------------------- |
| One update check      | one `device_events` row: 524 B (183 data + 340 in 6 indexes), about 4 KB of WAL |
| One device            | one `devices` row: 731 B, whatever its number of checks                         |
| One recording session | 744 B of row                                                                    |
| One segment           | 256 B of row + the blob, about 4 KB of WAL                                      |

At 3M checks a day that is about 1.6 GB a day of `device_events`, settling around 140 GB with the
default 90-day `DEVICE_EVENT_RETENTION_DAYS` (_estimate_). That is the number to plan the database
around; lower the retention, or keep fewer check events, before the fleet reaches that size.

## Overload

Shedding is in place now:

- **`DEVICE_MAX_INFLIGHT`** caps the device requests a process works on at once - by default twice
  `DATABASE_POOL_MAX`, at least 32. Past it a request is answered immediately with
  `503 {"reason":"busy"}` and a `Retry-After` of 2-5 s, jittered so devices do not return together.
  The updater plugin and the recorder both treat 503 as "try again later". Held policy requests do
  not count against the cap, since they wait rather than work.
- **`BACKGROUND_TASK_LIMIT`** (default 1,000) bounds the best-effort telemetry writes queued behind
  update checks. Past it new telemetry is skipped and counted instead of starving live requests of
  database connections; deletions of stored files are never skipped.
- Shed requests are neither logged as failures nor one line each: a summary every 10 s says how many
  were shed.

Measured on the same machine, same mix, pool 30, 60 s per run:

| Offered     | Without shedding                                       | Shedding, cap 64 (the default for pool 30 is 60)                                  |
| ----------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 500 req/s   | 23.6% errors (pg-pool timeouts after 10 s), p99 38.9 s | -                                                                                 |
| 600 req/s   | 419 ok/s, p99 28.4 s, 1.1 GB RSS                       | **537 ok/s, p99 383 ms**, 11% answered busy in under 110 ms, 276 MB RSS, 0 errors |
| 1,000 req/s | 437 ok/s, p99 77 s, 1.2 GB RSS                         | **417 ok/s, p99 442 ms**, 58% answered busy in under 170 ms, 280 MB RSS, 0 errors |

The first version used a fixed cap of 256: it removed the errors and bounded memory, but requests it
accepted still queued for seconds, which is why the cap now follows the pool. Shedding does not
raise the ceiling - the process is still CPU-bound at about 420-540 successful req/s on this
laptop - it keeps the requests a process does accept fast, and tells the rest to come back. More
throughput is more processes.

## Bottlenecks, in order

1. **CPU of the single Node event loop.** It is saturated in every overloaded run while PostgreSQL
   uses about one of twelve threads and its connections sit idle waiting for Node. Kysely query
   building is 18.6% of an update check's CPU; caching compiled queries on the hot path is the
   largest single win left.
2. **Telemetry writes compete with live queries** for the same pool. Bounded now; batching them
   would cut the statements per check from 3.2 to about 1.
3. **`device_events` growth** - six indexes are 65% of its size.
4. **The pool size matters little**: 10 to 30 connections gained 24-33% at 100 connections and
   nothing at higher concurrency.

## Scaling out

More processes behind a load balancer multiply the capacity of everything above: update checks,
stats and segment ingest are stateless. Three things are per process today and need a shared bus
(PostgreSQL `LISTEN/NOTIFY` is enough) before running more than one:

- the event hub behind the dashboard's live stream - a dashboard sees only the events of the process
  it is connected to;
- held policy requests - a rule change wakes the devices held by the process that saved it; others
  hear it within their listen window (up to 55 s) instead of in 300 ms;
- rate limits and the request cache - each process enforces and caches on its own, which is safe but
  loosens the per-device limits by the number of processes.

Behind a proxy, set `TRUST_PROXY` so the per-IP limit sees devices rather than the proxy: without
it, one IP's bucket (600 then 10/s) served 899 of 74,815 requests in 30 s.

## Against the Firebase version check

Reading a version from Firebase scales on Google's side with no work from us, and that is its real
strength. What it cannot do is decide: every rule (which channel, which native build is required, a
rollback, a staged rollout, keeping a dev flavour's bundle off production) has to live in the app,
shipped before it can apply. Capuchoo decides on the server in single-digit milliseconds, records
what each device did, and changes behaviour without a release.

On cost, Firebase Remote Config fetches move to pay-as-you-go from September 2026 (billing for
existing projects starts December 2026): 100,000 a day free, then
$0.06 per 10,000. If each of 3M
daily checks were a Remote Config fetch that is about $17 a day,
roughly $520 a month (_estimate_; it depends on how the old app fetched and cached). One Capuchoo
process on a small server covers the average load with room to spare. Source:
[Firebase Remote Config pricing](https://firebase.google.com/docs/remote-config/pricing?hl=en).

## Reproducing

The harness (autocannon runs, the constant-rate script, a per-second CPU/event-loop/pool monitor
loaded with `--import`, provisioning, statement counting) ran against a throwaway PostgreSQL
cluster. It is not committed; the scripts and raw results are kept with the benchmark notes.
