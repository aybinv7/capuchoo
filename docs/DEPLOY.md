# Deploying the monorepo

The five original repositories deployed themselves: each was a standalone project, so Render
inferred the build. A workspace cannot be inferred. The lockfile, the dependency catalog and the
toolchain all live at the repository root, so **every service builds from the root and selects its
package with a filter**. Setting Render's root directory to `services/back` hides
`pnpm-workspace.yaml`, and the install fails.

[render.yaml](../render.yaml) declares both services. Applying a Blueprint creates new services, so
the two that already exist are configured by hand with the same values, listed below.

The services are named `capuchoo-back` and `capuchoo-front`. **Renaming a Render service changes its
hostname**, and that hostname is compiled into every app already installed on a device - see
"Renaming the backend service" below before you do it.

## capuchoo-back — web service, Node

| Field             | Value                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Root Directory    | _empty_ (repository root)                                                                      |
| Build Command     | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter ./services/back run build` |
| Start Command     | `pnpm --filter ./services/back run start`                                                      |
| Health Check Path | `/health`                                                                                      |

Environment:

```
NODE_VERSION=24
NODE_ENV=production          # config validates this; server.ts registers module-alias only here
SUPABASE_URL=…
SUPABASE_SECRET_KEY=sb_secret_…
BUCKET_NAME=updates
ENVIRONMENT=prod
```

`PORT` is injected by Render and read by `config/index.ts`. `STORAGE_BASE_URL` is not needed -
nothing in `src/` reads it.

## capuchoo-front — static site

| Field             | Value                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Root Directory    | _empty_ (repository root)                                                                       |
| Build Command     | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter ./apps/dashboard run build` |
| Publish Directory | `apps/dashboard/dist`                                                                           |
| Rewrite rule      | `/*` → `/index.html`                                                                            |

Environment:

```
NODE_VERSION=24
VITE_SUPABASE_URL=…
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
VITE_API_URL=…
```

The rewrite is not optional: vue-router uses history mode, so refreshing `/channels/<id>` without it
is a 404 from the CDN rather than a route.

`VITE_` variables are **inlined into the bundle at build time**. Two consequences: a change needs a
rebuild, not a restart; and a secret key placed here is published to every visitor.

## Order of operations

The backend reads only the current key names (`SUPABASE_SECRET_KEY`), and the dashboard reads only
`VITE_SUPABASE_PUBLISHABLE_KEY`. The services deployed today are built from the _old_ repositories,
which read only the deprecated names - `capucho-front/src/services/auth.service.ts` references
`VITE_SUPABASE_ANON_KEY` and nothing else, and the old backend has `SUPABASE_KEY` as `required()`.
So the switch to the new names and the switch to this repository are the same event, and the
sequence matters:

1. **Create the new Supabase keys** (Settings > API Keys). Do not delete the legacy pair yet - it is
   what the running services still use.
2. **Repoint both Render services at this repository** with the settings above, and set the new
   environment variables. Deploy.
3. **Check the backend's startup log.** No `[config]` line means both keys resolved from the current
   names. A warning naming `SUPABASE_SERVICE_KEY`, or saying the credential was renamed rather than
   rotated, means the old value is still in use.
4. **Verify the dashboard logs in**, and that a device check reaches `/api/update`.
5. **Remove the deprecated variables** from both services: `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`,
   `VITE_SUPABASE_ANON_KEY`.
6. **Delete the legacy keys in Supabase.** This is the step that ends the exposure of the key that
   was committed to `capucho-back` - see [SUPABASE-KEYS.md](./SUPABASE-KEYS.md). Only after this is
   the value in git history inert, and only then is publishing this repository a cosmetic question.

Run `scripts/migrations/004_devices.sql` before or with step 2. Without the unique constraints it
adds, the device upserts have no `ON CONFLICT` target and telemetry still records nothing.

## Renaming the backend service

Renaming `capucho-back` to `capuchoo-back` on Render changes its hostname, and that is not a
cosmetic change: **the old hostname is compiled into every app already installed on a device.** It
reaches them through `capacitor.config.ts` at build time and ends up in
`android/app/src/main/assets/capacitor.config.json` inside the APK.

So a device running the current build asks `capucho-back.onrender.com`. Rename the service and that
host stops answering - which means the device cannot receive the very update that would tell it
about the new host. There is no recovery over the air; it needs a new APK, installed by hand or
through the store.

Two ways to do it safely:

- **Keep the hostname.** Put a custom domain (`api.capuchoo.dev` or similar) in front of the service
  and point the apps at that. The service can then be renamed freely, forever. This is worth doing
  before you have users, and it is the reason this document does not simply rename the URL.
- **Or migrate deliberately.** Stand up the new service alongside the old one, ship an app update
  pointing at the new hostname, wait until the fleet has taken it (`/dashboard/stats` shows what has
  checked in), and only then retire the old service.

Until one of those happens, `DEFAULT_ENDPOINT` in `packages/cli/src/commands/auth/login.ts` and the
`VITE_UPDATE_API_URL` in each flavour's env file deliberately still say
`capucho-back.onrender.com` - they name a host that exists, not one we would like to exist. Change
them in the same commit that completes the migration.

## What CI does, and does not do

`ci.yml` runs on every push to `main`: `vp check`, `vp run -r build`, `vp run -r test`. It does not
deploy. Render's own auto-deploy on push to `main` is what ships the two services, so a red CI run
and a successful deploy can coexist - CI is a signal, not a gate.

`deploy-app.yml` is `workflow_dispatch` only and ships a _mobile app_, not these services. It needs
six repository secrets before it can run: `CAPUCHO_ENDPOINT`, `CAPUCHO_API_KEY`,
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

`release.yml` publishes the four packages to npm through trusted publishing - see
[RELEASING.md](./RELEASING.md).
