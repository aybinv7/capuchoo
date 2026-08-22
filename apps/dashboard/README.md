# @capuchoo/dashboard

The Capuchoo web dashboard: organizations, apps, channels, releases, devices and update logs.

Deployed as a static site from the workspace root - see [docs/DEPLOY.md](../../docs/DEPLOY.md). It
is `private: true` and is not published to npm.

## Running it

```sh
vp install                  # from the workspace root
vp -C apps/dashboard dev
```

It needs three variables, and they are inlined into the bundle at build time - so a change needs a
rebuild, not a restart:

```
VITE_SUPABASE_URL=…
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
VITE_API_URL=https://your-backend.example.com
```

`VITE_SUPABASE_PUBLISHABLE_KEY` is the low-privilege key and is subject to row level security. Never
put an `sb_secret_…` key in a `VITE_` variable: Vite writes it into the bundle every visitor
downloads. See [docs/SUPABASE-KEYS.md](../../docs/SUPABASE-KEYS.md).

## How it talks to the backend

Two paths, deliberately:

- **Supabase directly** for authentication and for reads that row level security already governs.
- **The Capuchoo API** (`VITE_API_URL`) for everything that needs a privileged decision - creating
  apps and channels, uploading artefacts, reading device and update history.

## The one rule worth knowing

A channel's **environment** decides which `.env` flavour the CLI builds and which bundles the server
serves. Its _name_ is only a label. A channel named `prod` sitting on the `staging` environment
serves staging bundles to production devices, and nothing errors - so the channel forms refuse to
default it, require an explicit choice, and warn when a name and an environment disagree.

## Testing

```sh
vp -C apps/dashboard test
```

There is one shared helper under test here today; the channel-environment rules moved to
`@capuchoo/core` so the CLI and the server share one implementation.
