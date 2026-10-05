# Capuchoo server

`services/server` (`@capuchoo/server`): Node 22+, Hono, Kysely over PostgreSQL. One process serves
the device API, the CLI API and the dashboard API. The dashboard is a separate static site whose
host proxies `/api` here, so it is still same-origin to the browser: the session is an httpOnly
cookie and there is no CORS. When that proxy rewrites the host (Render), list the dashboard origin
in `ALLOWED_ORIGINS`.

## Delivery model

- An **artefact** (OTA bundle or native build) belongs to an app and a flavour. It is uploaded once.
- A **channel** is a pointer: `current_bundle_id` and `current_native_id`. Delivering means moving a
  pointer. Every pointer write goes through `canPoint` in `@capuchoo/core`.
- A channel's `environment` is fixed once it has pointed at anything.
- `kind: "release"` channels (`dev`, `staging`, `prod`) take uploads. `kind: "client"` channels
  (`prod-acme`) have a `base_channel_id` and only point at artefacts their base has served.
- A device's channel is resolved server-side: dashboard assignment, then self-set (only when the
  channel allows it), then the channel the build reports. One APK serves every client.
- `paused` stops a channel serving anything. `allow_downgrade` is set by a rollback, so devices
  accept a lower version.

## Roles

Org roles `owner > admin > member`; app roles `admin > developer > tester > viewer`. Org owner/admin
count as app admin. An API key can be restricted to one app and capped at a role (`effectiveRole`).
Rules:

| Action                                                            | Needs                                |
| ----------------------------------------------------------------- | ------------------------------------ |
| read an app, its channels, devices, stats                         | viewer                               |
| upload to a dev/staging channel, point dev/staging                | developer                            |
| upload to or point a prod or client channel, rollback, pause      | admin                                |
| manage channels, identifiers, permissions, keys scoped to the app | admin                                |
| delete an app, manage org members                                 | org admin; ownership transfer: owner |

Signup is off (`SIGNUP=closed`). The first instance admin comes from `BOOTSTRAP_ADMIN_EMAIL` /
`BOOTSTRAP_ADMIN_PASSWORD` on an empty database; everyone else is invited.

## Release signing

ECDSA P-256 / SHA-256 through WebCrypto, so Node and the WebView share one implementation in core.

```
payload   = "capuchoo-release-v1\n" + kind + "\n" + appId + "\n" + platform + "\n"
            + version + "\n" + (versionCode ?? "") + "\n" + sha256hex
signature = base64url(IEEE P1363 r||s)
publicKey = base64(SPKI DER)
```

`kind` is `ota` or `native`; `appId` is the app's primary bundle id. The CLI signs with
`CAPUCHOO_SIGNING_KEY` (base64 PKCS#8) or `.capuchoo/signing-key.pem` (git-ignored). The server
stores the app's public key, refuses a bad signature, and refuses an unsigned upload when the app
has `require_signature`. The update response carries `signature`; the updater verifies it against
the public key baked into the build before applying anything.

## Wire compatibility

Device endpoints are unchanged: `POST /api/update`, `POST /api/stats`,
`GET|POST|PUT|DELETE /api/channel_self`, `POST /api/native-updates/log`. OTA responses gain
`signature`; native payloads gain `checksum` (sha256) and `signature`.

CLI endpoints keep the paths and shapes of `packages/cli/src/services/cloud.ts`, with these
additions:

| Method | Path                                 | Body / result                                                              |
| ------ | ------------------------------------ | -------------------------------------------------------------------------- |
| POST   | `/api/channels/:id/point`            | `{ bundle_id?, native_id?, rollback?, reason? }` → channel                 |
| POST   | `/api/channels/:id/pause` / `resume` | → channel                                                                  |
| GET    | `/api/channels/:id/history`          | pointer moves, newest first                                                |
| GET    | `/api/apps/:id/artefacts`            | bundles and native builds, eligible channels                               |
| POST   | `/api/apps/:id/builds`               | `{ kind, channel, version, source, commit, ref, pipeline_url }` → `{ id }` |
| POST   | `/api/builds/:id/events`             | `{ step, status: running\|succeeded\|failed\|skipped, message }`           |
| POST   | `/api/builds/:id/finish`             | `{ status, bundle_id?, native_id?, error? }`                               |
| GET    | `/api/apps/:id/stream`               | SSE: `build`, `build_event`, `build_job`, `channel`, `device`              |
| GET    | `/api/apps/:id/poll?after=&wait=`    | The same events as a long poll, for paths that buffer streams (see below)  |
| POST   | `/api/integrations/gitlab/:appId`    | GitLab webhook, `X-Gitlab-Token`                                           |
| POST   | `/api/integrations/github/webhook`   | GitHub App webhook, `X-Hub-Signature-256`                                  |

`POST /api/apps/:id/builds` also takes `ci: { provider, run_id, run_attempt, job }`, attaching the
deploy to the CI run it runs in. Everything about CI providers - the GitHub App, installations,
starting runs, the setup pull request - is in [CI-PROVIDERS.md](./CI-PROVIDERS.md). | PUT |
`/api/apps/:id/signing` | `{ public_key, require_signature }` |

Uploads (`/api/admin/upload`, `/api/admin/native-upload`) are authorized before the body is read and
streamed to storage while hashed. They accept `signature`, `build_id`, `flavour` (required) and, for
native, `signing_cert_sha256`; the server refuses a native build whose certificate differs from the
app's previous release unless `allow_cert_change=true` is sent by an admin.

## Session recording

Devices: `POST /api/recording/policy` (`{ appId, deviceId, platform, versionName, channel, known }`
→ `{ policy, known_assets }` or `{ unchanged, version }`), `POST /api/recording/segments` (gzip
NDJSON, metadata in `x-capuchoo-recording`), `POST /api/recording/assets` (raw file, metadata in
`x-capuchoo-asset`). Dashboard: `GET /api/apps/:id/recordings`, `GET|DELETE /api/recordings/:id`,
`GET /api/recordings/:id/segments/:seq` (served `content-encoding: gzip`),
`GET /api/recording-assets/:id`, `GET|PUT /api/apps/:id/recording-rules`,
`DELETE /api/recording-rules/:id`, `GET /api/devices/:id/recording-policy`. A stored segment emits a
`recording` live event. The design is in [RECORDING.md](./RECORDING.md).

## Storage

`STORAGE_DRIVER=fs` (default, `STORAGE_DIR`), `s3` (any S3-compatible: MinIO, R2) or `postgres`
(small installs and the free-tier demo). Downloads go through `GET /api/artefacts/:key?exp=&sig=`,
an HMAC link valid for `ARTEFACT_URL_TTL` seconds, with `Range` support so an APK download resumes.

## Operations

`vp run --filter @capuchoo/server migrate` applies Kysely migrations; the server also migrates on
boot unless `MIGRATE_ON_BOOT=false`. `GET /health` is liveness, `GET /ready` checks the database.
Logs are JSON lines with a request id; passwords, tokens, keys and coordinates are redacted.
`DEVICE_EVENT_RETENTION_DAYS` (default 90) bounds telemetry.

## Live events behind a buffering proxy

`GET /api/apps/:id/stream` is Server-Sent Events. Some paths hold a streamed response until it ends

- Render's static-site `/api/*` rewrite held the first byte for 500 seconds, and corporate proxies
  do the same - so the dashboard waits 5 s for the stream's `ready` and otherwise switches the tab
  to `GET /api/apps/:id/poll`. The first call (no `after`) returns a cursor at once; each next call
  returns the app's events after it as soon as there are any, or an empty page after `wait` seconds
  (at most 25). The hub keeps the last 500 events or 5 minutes per app; a cursor older than that
  comes back with `reset: true`, and the dashboard refetches instead of trusting a page with a hole
  in it. The backlog is in memory, like the hub, so one server instance is assumed.
