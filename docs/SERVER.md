# Capuchoo server

`services/server` (`@capuchoo/server`) replaces `services/back`. Node 22+, Hono, Kysely over
PostgreSQL. No Supabase. One process serves the device API, the CLI API, the dashboard API and the
dashboard itself (same origin, so the session is an httpOnly cookie and there is no CORS).

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
| GET    | `/api/apps/:id/stream`               | SSE: `build`, `build_event`, `channel`, `device`                           |
| POST   | `/api/integrations/gitlab/:appId`    | GitLab webhook, `X-Gitlab-Token`                                           |
| PUT    | `/api/apps/:id/signing`              | `{ public_key, require_signature }`                                        |

Uploads (`/api/admin/upload`, `/api/admin/native-upload`) are authorized before the body is read and
streamed to storage while hashed. They accept `signature`, `build_id`, `flavour` (required) and, for
native, `signing_cert_sha256`; the server refuses a native build whose certificate differs from the
app's previous release unless `allow_cert_change=true` is sent by an admin.

## Storage

`STORAGE_DRIVER=fs` (default, `STORAGE_DIR`), `s3` (any S3-compatible: MinIO, R2) or `postgres`
(small installs and the free-tier demo). Downloads go through `GET /api/artefacts/:key?exp=&sig=`,
an HMAC link valid for `ARTEFACT_URL_TTL` seconds, with `Range` support so an APK download resumes.

## Operations

`vp run --filter @capuchoo/server migrate` applies Kysely migrations; the server also migrates on
boot unless `MIGRATE_ON_BOOT=false`. `GET /health` is liveness, `GET /ready` checks the database.
Logs are JSON lines with a request id; passwords, tokens, keys and coordinates are redacted.
`DEVICE_EVENT_RETENTION_DAYS` (default 90) bounds telemetry.
