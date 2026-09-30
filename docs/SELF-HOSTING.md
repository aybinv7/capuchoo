# Self-hosting Capuchoo

One container (`deploy/Dockerfile`) serves the device API, the CLI API and the dashboard, next to
PostgreSQL. Everything below is for the operator; developers only need `PUBLIC_URL`.

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

The compose file expects an existing Traefik on the external `traefik` network with a
`letsencrypt` resolver. Artefacts are on the `artefacts` volume (`STORAGE_DRIVER=fs`); for several
instances use `STORAGE_DRIVER=s3` against MinIO or R2.

## Operations

| Concern | How |
| --- | --- |
| Migrations | Applied on boot (`MIGRATE_ON_BOOT=true`), or `node server/dist/migrate.mjs` before rollout |
| Health | `GET /health` liveness, `GET /ready` database + storage |
| Backups | The `backup` service writes `pg_dump -Fc` daily to the `backups` volume, kept 14 days |
| Restore | `pg_restore --clean --no-owner -d capuchoo capuchoo-<stamp>.dump`, then restart `server` |
| Logs | JSON lines on stdout with `request_id`; secrets, tokens and coordinates are redacted |
| Retention | Device events older than `DEVICE_EVENT_RETENTION_DAYS` (90) are purged hourly |
| Artefact backups | Back up the `artefacts` volume (or the S3 bucket) with the database; a restored row without its file cannot be served |

Test a restore before you need one. A backup that has never been restored is a hope.

## Render (development instance)

`render.yaml` describes a free web service and a free PostgreSQL with `STORAGE_DRIVER=postgres`,
because the free plan has no persistent disk. It is for trials: the free database expires and the
service sleeps, so do not point production builds at it. `autoDeploy` is off; CI triggers the deploy
hook after checks pass.
