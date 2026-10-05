# Deploying Capuchoo

Capuchoo delivers over-the-air (web bundle) and native (APK) updates to Capacitor apps, and records
sessions on devices for replay. This guide is for whoever runs it on a server. It covers what in
this repository gets deployed, what does not, and how to deploy, update, back up and reach it.

## The monorepo, and what of it runs on the VPS

One repository holds every part of Capuchoo, managed as a pnpm workspace through
[Vite+](https://viteplus.dev) (`vp`). Only three of its parts run on the VPS. The rest ship
somewhere else, or are not shipped at all.

| Path                   | What it is                                                            | On the VPS? | Where it ships instead                    |
| ---------------------- | --------------------------------------------------------------------- | ----------- | ----------------------------------------- |
| `services/server`      | The API: devices, releases, channels, recordings, CI, MCP             | **Yes**     | Docker image `capuchoo/server`            |
| `apps/dashboard`       | The web console, static files                                         | **Yes**     | Docker image `capuchoo/dashboard` (nginx) |
| PostgreSQL 17          | All state except artefact files                                       | **Yes**     | Official `postgres:17-alpine` image       |
| `packages/core`        | Contract shared by every package; built into the server and dashboard | Inside them | npm `@capuchoo/core`                      |
| `packages/updater`     | Runtime embedded in each Capacitor app                                | No          | npm `@capuchoo/updater`                   |
| `packages/recorder`    | Session recorder embedded in each app                                 | No          | npm `@capuchoo/recorder`                  |
| `packages/cli`         | Builds and publishes releases from a developer machine or CI          | No          | npm `@capuchoo/cli`                       |
| `packages/android`     | Updater library for native Android apps                               | No          | JitPack (`jitpack.yml`)                   |
| `apps/mobile`          | The Capuchoo app for phones                                           | No          | APK, built by its developer               |
| `apps/landing`         | Public marketing page                                                 | No          | Not deployed                              |
| `tools/recorder-bench` | Measures the recorder's cost on a device                              | No          | Never; a developer tool                   |

Everything under `deploy/` belongs to the VPS:

```
deploy/
├── docker-compose.yml     the stack below
├── .env.example           every setting the stack reads; copy to .env
├── Dockerfile             server image
├── dashboard/             dashboard image, nginx config, security headers
└── backup.sh              the daily database dump
```

## What runs

```
                 :80 ─► redirect to https
 internet ─► traefik :443 ─┬─ /api, /health, /ready ─► server :3000 ─► postgres :5432
           (Let's Encrypt) │   (websockets included)        │              ▲
                           └─ everything else ─► dashboard :8080   artefacts volume
                                                                            │
                                                     backup (daily pg_dump) ┘
```

- **One hostname** serves both the API and the dashboard. The browser sees one origin, so the
  session cookie stays first-party and there is no CORS.
- **traefik** requests and renews certificates, and redirects HTTP to HTTPS. It reads Docker through
  **docker-proxy**, a read-only API, so the container facing the internet never holds the Docker
  socket.
- **server** runs its database migrations each time it starts. Keep it at **one replica**: the live
  stream and the dashboard's event stream are held in that process.
- **postgres** is published on `127.0.0.1` of the VPS only.

| Volume        | Holds                                           | Back it up |
| ------------- | ----------------------------------------------- | ---------- |
| `postgres`    | The database                                    | Yes        |
| `artefacts`   | Uploaded bundles, APKs, recordings, source maps | Yes        |
| `backups`     | Daily dumps, kept `BACKUP_KEEP_DAYS` (14) days  | Copy off   |
| `letsencrypt` | Certificates; reissued automatically if lost    | No         |

## Before the first deploy

- A Linux VPS with Docker Engine 24 or later and the compose plugin (`docker compose version`).
- Images are built on the VPS, and the build installs the whole workspace. On less than 4 GB of RAM,
  add swap before the first build.
- A DNS A (or AAAA) record for the chosen hostname, pointing at the VPS.
- A firewall that admits only 22, 80 and 443 in. Port 443 must be reachable from the internet for
  the certificate challenge.
- Outbound internet access for the npm registry during the build, Let's Encrypt, and GitHub if CI is
  connected.

Pick the hostname carefully. It is compiled into every app build, so changing it later means
shipping new native builds.

## First deploy

```bash
git clone https://gitlab.sigservice-dz.com/amine.chebil/capuchoo.git
cd capuchoo/deploy
cp .env.example .env
```

Fill in `.env`:

| Variable                   | Value                                                             |
| -------------------------- | ----------------------------------------------------------------- |
| `CAPUCHOO_HOST`            | The hostname, without `https://`                                  |
| `ACME_EMAIL`               | Where Let's Encrypt sends expiry notices                          |
| `POSTGRES_PASSWORD`        | `openssl rand -base64 32`                                         |
| `SECRET_KEY`               | `openssl rand -base64 48`, generated once and kept (see Security) |
| `BOOTSTRAP_ADMIN_EMAIL`    | The first admin's email                                           |
| `BOOTSTRAP_ADMIN_PASSWORD` | At least 12 characters; remove both lines after the first sign-in |

The other variables have working defaults. Then, from the `deploy` directory:

```bash
chmod 600 .env
docker compose up -d --build
```

Check that it is up:

```bash
docker compose ps
curl -fsS https://$CAPUCHOO_HOST/health
curl -fsS https://$CAPUCHOO_HOST/ready
```

- **The services:** every one should be `running`, and `server` should be `healthy`.
- **`/health` and `/ready`:** both return 200 when the server and its database are up.
- **The dashboard:** open `https://<hostname>`, sign in with the bootstrap admin, then remove the
  two `BOOTSTRAP_ADMIN_*` lines from `.env`.
- **More accounts:** sign-up is closed, so invite everyone else from the dashboard.

## Updating

```bash
cd capuchoo
git pull
cd deploy
docker compose up -d --build
```

- **Migrations** run when the new server starts.
- **Downtime:** a few seconds while the server container is replaced, since there is one replica.
  Devices retry their update checks, so nothing is lost.
- **Rolling back:** `git checkout <previous-commit>`, then the same `up -d --build`. If the update
  ran a migration, restore the database from the dump taken before it (see Backups). The server only
  migrates forward.

## Reaching the database

Postgres listens on `127.0.0.1:5432` of the VPS. Connect a desktop client through SSH:

- **A client with an SSH tab:** SSH to the VPS, then connect to `localhost:5432`, with database and
  user `capuchoo` and the `POSTGRES_PASSWORD`.
- **Any other client:** open a tunnel, then connect to `localhost:15432`:

  ```bash
  ssh -N -L 15432:127.0.0.1:5432 user@your-vps
  ```

Never publish 5432 to the internet. If the port is already taken on the VPS, set `POSTGRES_PORT`.

## Backups

The `backup` service dumps the database once a day. From `deploy/`:

```bash
docker compose exec backup sh /usr/local/bin/backup.sh
docker compose exec backup ls -lh /backups
```

- **The first command** takes a dump now; run it before every update.
- **The second** lists the dumps.

To restore a dump, then restart the server:

```bash
docker compose exec backup pg_restore --clean --no-owner -d capuchoo /backups/capuchoo-<stamp>.dump
docker compose restart server
```

- **Keep copies off the VPS:** the dumps and the `artefacts` volume both live on the VPS. Copy them
  elsewhere, together, because a database row whose file is missing cannot be served.
- **Test a restore** once before you need one.

## Day to day

| Task                      | Command (from `deploy/`)                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| Follow server logs        | `docker compose logs -f server`                                                                        |
| Restart one service       | `docker compose restart server`                                                                        |
| Disk used by volumes      | `docker system df -v`                                                                                  |
| Reset an admin's password | `docker compose exec -e ADMIN_EMAIL=you@x.com -e ADMIN_PASSWORD='…' server node server/dist/admin.mjs` |
| Stop everything           | `docker compose down` (volumes are kept; `down -v` deletes all data)                                   |

Logs are JSON lines on stdout, with secrets and tokens redacted.

## Moving apps onto this server

This part is the app developer's job, not the operator's. An app finds its server through
`VITE_UPDATE_API_URL`, which is compiled into its native build. To move an app here:

1. Set `VITE_UPDATE_API_URL=https://<hostname>` in its flavour env files.
2. Sign the CLI in to this server with `capuchoo auth login`.
3. Ship one new native build.

From then on, OTA updates arrive through this server.

## Security

- **Never commit `deploy/.env`.** It is git-ignored, and it holds the database password and
  `SECRET_KEY`.
- **Do not change `SECRET_KEY` casually.** It signs download links and encrypts the GitHub App's
  stored secrets. Changing it invalidates both, and the GitHub App must then be created again from
  the dashboard.
- **Only Traefik is public.** The server, dashboard and database are reachable only through it,
  except Postgres on localhost.

## When something is wrong

| Symptom                                   | Likely cause                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| Browser warns about the certificate       | DNS not yet pointing at the VPS, or 443 blocked; `docker compose logs traefik`            |
| 404 from Traefik on every path            | `CAPUCHOO_HOST` does not match the hostname in the browser                                |
| 502 / 503 on `/api`                       | Server starting or crashing; `docker compose logs server` (a failed migration shows here) |
| `/ready` fails, `/health` works           | Database or artefact storage unreachable                                                  |
| Dashboard live view never connects        | A proxy in front of this stack that drops websockets                                      |
| `up --build` killed during `pnpm install` | Out of memory; add swap                                                                   |

More detail lives in [docs/SELF-HOSTING.md](../docs/SELF-HOSTING.md): connecting GitHub, S3 storage,
demo data and capacity.
