# Self-hosting Capuchoo

Two containers next to PostgreSQL: the server (`deploy/Dockerfile`) serves the device, CLI and
dashboard APIs; the dashboard (`deploy/dashboard/Dockerfile`) is static files behind nginx. Traefik
routes `/api`, `/health` and `/ready` to the server and everything else to the dashboard, on one
hostname, so the browser sees one origin and the session cookie stays first-party. Everything below
is for the operator; developers only need `PUBLIC_URL`.

## First, the domain

The update URL is compiled into every APK. Pick a hostname you will keep for years
(`updates.<company>.dz`), point it at the host, and never ship a build with a provider or IP-derived
hostname like `*.sslip.io`. Moving hosts later is then a DNS change, not a stranded fleet.

## Run it

A VPS with Docker Engine and the compose plugin, ports 80 and 443 open, and the hostname's A/AAAA
record pointing at it. On the VPS:

```bash
git clone <repository-url> capuchoo && cd capuchoo
cp deploy/.env.example deploy/.env
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

Fill `deploy/.env` first: `CAPUCHOO_HOST`, `ACME_EMAIL`, `POSTGRES_PASSWORD`
(`openssl rand -base64 32`) and `SECRET_KEY` (`openssl rand -base64 48`, generated once and kept: it
signs download links and encrypts the GitHub App's secrets). `PUBLIC_URL` is
`https://$CAPUCHOO_HOST`. `BOOTSTRAP_ADMIN_*` creates the first instance admin on an empty database
and is ignored afterwards; remove it from `.env` once you have signed in. Sign-up is closed; invite
everyone else from the dashboard.

The stack:

| Service        | Role                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------- |
| `traefik`      | Ports 80 and 443, Let's Encrypt (TLS-ALPN challenge), HTTP to HTTPS redirect              |
| `docker-proxy` | Read-only Docker API for Traefik, so the internet-facing container never holds the socket |
| `server`       | `/api`, `/health`, `/ready`, including the live and assist websockets                     |
| `dashboard`    | Everything else on the same hostname, so the session cookie stays first-party             |
| `postgres`     | Published on `127.0.0.1` only                                                             |
| `backup`       | Daily `pg_dump -Fc` to the `backups` volume                                               |

Traefik's read timeout is raised to 30 minutes: its default of 60 seconds cuts a large bundle or APK
upload on a slow link. Upload size is enforced by the server (`MAX_BUNDLE_BYTES`,
`MAX_NATIVE_BYTES`) while it streams, so Traefik does not buffer bodies. Run one `server` replica:
the live stream hub and the dashboard's event stream are held in that process.

To update: `git pull`, then the same `up -d --build`. Migrations run when the server starts.

## Reaching the database

Postgres listens on `127.0.0.1:5432` of the VPS and nowhere else. A desktop client connects through
SSH: most have an SSH tab (host and user of the VPS, then `localhost:5432`, database and user
`capuchoo`, the `POSTGRES_PASSWORD`). Without one, open a tunnel and point the client at
`localhost:15432`:

```bash
ssh -N -L 15432:127.0.0.1:5432 user@vps
```

Do not publish 5432 to the internet. If the port is already taken on the VPS, set `POSTGRES_PORT`.

## Connecting GitHub

An instance admin creates the GitHub App from the dashboard (Settings > GitHub). Every URL in it is
built from `PUBLIC_URL`, so set `PUBLIC_URL` to the address people sign in at - **the dashboard's
origin** when the dashboard proxies `/api` - before creating it. GitHub sends the browser back to
`PUBLIC_URL/api/github/...`, and the session cookie only exists on the dashboard's origin; a
`PUBLIC_URL` on the server's own host comes back signed out. Webhooks go to the same origin and
reach the server through the rewrite.

The App's private key and secrets are stored encrypted under a key derived from `SECRET_KEY`.
Changing `SECRET_KEY` makes them unreadable: delete the App in the dashboard and create it again,
then reinstall it. To manage the App outside the database instead, set `GITHUB_APP_ID`,
`GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` (PEM, `\n`-escaped is accepted),
`GITHUB_WEBHOOK_SECRET`, `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`; the App must request user
authorization during installation, or installations cannot be verified and are refused.

The dashboard's Content-Security-Policy needs `form-action 'self' https://github.com`, because
creating the App is a form POST to GitHub. Starting GitLab pipelines needs no setting unless the
GitLab is on a private network: then list its host in `GITLAB_ALLOWED_HOSTS`, which also lifts the
https and public-address checks for those hosts. More in [CI-PROVIDERS.md](./CI-PROVIDERS.md).

## On Coolify

A Coolify instance can run the same stack without the compose file. Create one project with three
resources:

- **PostgreSQL**: a database on `postgres:17-alpine`, not public. The server reaches it by the
  database's internal hostname.
- **`server`**: an application built from `deploy/Dockerfile` (base directory `/`, port 3000) with a
  persistent volume mounted at `/data`.
- **`dashboard`**: an application built from `deploy/dashboard/Dockerfile` (base directory `/`, port
  8080).

Both applications share one hostname, as Traefik does in the compose stack. Give the dashboard the
bare domain and the server the same domain once per path, comma separated:
`https://HOST/api,https://HOST/health,https://HOST/ready`. Coolify's proxy picks the longer rule, so
those paths reach the server and everything else reaches the dashboard. Turn **Strip Prefixes** off
on the server: it expects `/api` intact.

Leave Coolify's own health check off. The images carry a `HEALTHCHECK` (Node for the server, `wget`
for nginx) and Coolify uses it; its default check needs `curl` or `wget` inside the container and
fails the rollout on the server image.

Server environment: `DATABASE_URL`, `SECRET_KEY`, `PUBLIC_URL` (`https://HOST`),
`STORAGE_DRIVER=fs`, `TRUST_PROXY=true` and `COOKIE_SECURE=true`. The dashboard and the server share
a host, so there is no rewrite and `ALLOWED_ORIGINS` is not needed. Run one server instance. There
is no `backup` service here: schedule database and volume backups in Coolify.

Deploys are triggered by CI after checks pass, so Coolify's own auto-deploy stays off. The `deploy`
job calls Coolify's deploy API for both applications. It needs the repository secrets `COOLIFY_URL`
and `COOLIFY_TOKEN` (an API token with the `deploy` ability) and the repository variables
`COOLIFY_SERVER_UUID` and `COOLIFY_DASHBOARD_UUID`.

The public landing page (`apps/landing`) is a separate static site: it holds no secret and needs no
rewrite. Build command
`pnpm install --frozen-lockfile && pnpm --filter "{apps/landing}..." run build`, publish directory
`apps/landing/dist`, and `VITE_DASHBOARD_URL` set to the dashboard's address so "Sign in" lands
there. For several server instances use `STORAGE_DRIVER=s3` against MinIO or R2 instead of the
`artefacts` volume.

## The first admin, and getting back in

On an empty database, `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` create the first
instance admin at boot; they do nothing once any user exists. For every later case (a database that
already has users, a forgotten password), run the admin command against the same database. It reads
both values from the environment, never from arguments, creates the account or resets its password,
makes it an instance admin, and signs it out everywhere:

```sh
ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='at least 12 characters' node server/dist/admin.mjs
```

In the Docker image that is `docker compose exec server node server/dist/admin.mjs` with the two
variables passed through `-e`.

## Demo data

A fictional organization, Northwind Distribution, for presentations and screenshots:

- **Northwind Field Sales**, shipped through GitHub Actions: dev, staging and prod with three client
  channels at their own pace (one paused for a stock count), signed releases, a native release that
  gates newer bundles, a rollback after a crash spike, and about twenty CI runs - one still running,
  a delivery waiting for prod approval, a red pull request, a flaky staging build fixed on retry, a
  native build that failed on its signing certificate - with their jobs, steps, logs and the deploys
  inside them.
- **Northwind Delivery**, shipped through GitLab CI: stage-ordered pipelines with manual native and
  delivery jobs, one pipeline still waiting on a person.
- About 200 devices across both apps with 28 days of checks, deliveries and failures.

On a server with `DEMO_SEED=enabled`, an instance admin creates or resets it from the dashboard
(Settings > Demo), or with `POST /api/admin/demo`. Locally, after a build,
`DEMO_EMAIL=you@example.com pnpm --filter @capuchoo/server run seed:demo` does the same for an
existing account. Either way the organization is replaced in one transaction and owned by that
account. The in-progress run is closed by housekeeping after a day, so reset it before a demo.

## Operations

| Concern          | How                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migrations       | Applied on boot (`MIGRATE_ON_BOOT=true`), or `node server/dist/migrate.mjs` before rollout                                                                                     |
| Health           | `GET /health` liveness, `GET /ready` database + storage                                                                                                                        |
| Backups          | The `backup` service writes `pg_dump -Fc` daily to the `backups` volume, kept 14 days                                                                                          |
| Restore          | `pg_restore --clean --no-owner -d capuchoo capuchoo-<stamp>.dump`, then restart `server`                                                                                       |
| Logs             | JSON lines on stdout with `request_id`; secrets, tokens and coordinates are redacted                                                                                           |
| Retention        | Device events older than `DEVICE_EVENT_RETENTION_DAYS` (90) are purged hourly                                                                                                  |
| Artefact backups | Back up the `artefacts` volume (or the S3 bucket) with the database; a restored row without its file cannot be served                                                          |
| Overload         | Past `DEVICE_MAX_INFLIGHT` device requests at once (default twice `DATABASE_POOL_MAX`, at least 32) a process answers 503 with `Retry-After`; see [CAPACITY.md](./CAPACITY.md) |
| Telemetry queue  | Past `BACKGROUND_TASK_LIMIT` (1000) pending writes, device telemetry is skipped and counted rather than queued                                                                 |

Test a restore before you need one. A backup that has never been restored is a hope.
