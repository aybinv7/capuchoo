# Self-hosting Capuchoo

Two containers next to PostgreSQL: the server (`deploy/Dockerfile`) serves the device, CLI and
dashboard APIs; the dashboard (`deploy/dashboard/Dockerfile`) is static files behind nginx. Traefik
routes `/api`, `/health` and `/ready` to the server and everything else to the dashboard, on one
hostname, so the browser sees one origin and the session cookie stays first-party. Everything below
is for the operator; developers only need `PUBLIC_URL`.

## First, the domain

The update URL is compiled into every APK. Pick a hostname you will keep for years
(`updates.<company>.dz`), point it at the host, and never ship a build with a provider hostname like
`*.onrender.com`. Moving hosts later is then a DNS change, not a stranded fleet.

## Run it

```bash
cp deploy/.env.example deploy/.env
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

`SECRET_KEY` signs download links; generate it once with `openssl rand -base64 48` and keep it.
`BOOTSTRAP_ADMIN_*` creates the first instance admin on an empty database and is ignored afterwards;
remove it from `.env` once you have signed in. Sign-up is closed; invite everyone else from the
dashboard.

The compose file expects an existing Traefik on the external `traefik` network with a `letsencrypt`
resolver. Upload size is enforced by the server (`MAX_BUNDLE_BYTES`, `MAX_NATIVE_BYTES`) while it
streams, so Traefik does not buffer bodies.

## On Render

`render.yaml` creates `capuchoo-server`, the `capuchoo-dashboard` static site and the database. The
static site rewrites `/api/*` to the server, so the dashboard stays same-origin with its API. Two
values have to match reality after the first apply:

- the rewrite destination in `render.yaml` must be the server's real URL (Render appends a suffix
  when `capuchoo-server` is taken, and a custom domain replaces it);
- `ALLOWED_ORIGINS` on the server must be the dashboard's origin, because behind the rewrite the
  server sees its own host while the browser sends the dashboard's `Origin`.

Deploys are triggered by CI after checks pass (`RENDER_DEPLOY_HOOK`,
`RENDER_DASHBOARD_DEPLOY_HOOK`). Artefacts are on the `artefacts` volume (`STORAGE_DRIVER=fs`); for
several instances use `STORAGE_DRIVER=s3` against MinIO or R2.

## Operations

| Concern          | How                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Migrations       | Applied on boot (`MIGRATE_ON_BOOT=true`), or `node server/dist/migrate.mjs` before rollout                            |
| Health           | `GET /health` liveness, `GET /ready` database + storage                                                               |
| Backups          | The `backup` service writes `pg_dump -Fc` daily to the `backups` volume, kept 14 days                                 |
| Restore          | `pg_restore --clean --no-owner -d capuchoo capuchoo-<stamp>.dump`, then restart `server`                              |
| Logs             | JSON lines on stdout with `request_id`; secrets, tokens and coordinates are redacted                                  |
| Retention        | Device events older than `DEVICE_EVENT_RETENTION_DAYS` (90) are purged hourly                                         |
| Artefact backups | Back up the `artefacts` volume (or the S3 bucket) with the database; a restored row without its file cannot be served |

Test a restore before you need one. A backup that has never been restored is a hope.

## Render (development instance)

`render.yaml` describes a free web service and a free PostgreSQL with `STORAGE_DRIVER=postgres`,
because the free plan has no persistent disk. It is for trials: the free database expires and the
service sleeps, so do not point production builds at it. `autoDeploy` is off; CI triggers the deploy
hook after checks pass.
