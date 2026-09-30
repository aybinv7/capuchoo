# @capuchoo/dashboard

The Capuchoo release console: channels, releases, the release canvas, builds, devices, statistics,
the audit log and settings. It is `private: true` and is not published to npm.

`@capuchoo/server` serves the built dashboard from the same origin (`DASHBOARD_DIR`). There is no
API URL to configure and no key in the bundle: the API is the relative `/api`, and the session is
the httpOnly cookie `POST /api/auth/login` sets. Nothing is kept in `localStorage` except UI
preferences (theme, last organization).

## Running it

```sh
vp install                  # from the workspace root
vp run libs                 # @capuchoo/core is imported from its dist
vp -C apps/dashboard dev
```

The dev server proxies `/api` to `http://localhost:3000` (override with `CAPUCHOO_API_TARGET`). The
proxy keeps the browser's `Host` and `Origin`, which the server's CSRF check compares for every
cookie-authenticated write.

## Layout

- `src/modules/<feature>` - self-contained features (auth, apps, canvas, channels, releases, builds,
  devices, statistics, audit, settings), each with its pages, components, composables, services,
  types and `routes.ts`. A module never imports another module.
- `src/shared` - what modules share: the API client and error mapping, query keys, the session and
  role gates, the live stream reducer, and the delivery dialogs (Deliver, Roll back, Pause).
- `src/components/ui` - shadcn-vue primitives.

## Rules that matter

- Channel pointers move only through the delivery actions. Every dialog previews the move with
  `canPoint` from `@capuchoo/core`, from the same facts the server loads, and shows the server's
  `{ error, reason }` when it still refuses.
- Role gates (`src/shared/lib/roles.ts`) mirror the server policy to decide what to offer. They
  grant nothing; `prod_role` on the app decides who delivers to prod.
- The live stream (`GET /api/apps/:id/stream`) updates the query cache through
  `src/shared/live/stream-reducer.ts`, a pure function with its own tests.

## Testing

```sh
vp -C apps/dashboard test
vp -C apps/dashboard run typecheck
```
