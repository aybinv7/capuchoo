# Supabase keys

Supabase replaced its JWT API keys. The old pair still works and is documented as deprecated, with
removal announced for **the end of 2026**:

| Legacy (deprecated)  | Current                         | Privileges                           |
| -------------------- | ------------------------------- | ------------------------------------ |
| `anon` (JWT)         | publishable, `sb_publishable_…` | Low. Subject to row level security.  |
| `service_role` (JWT) | secret, `sb_secret_…`           | Full. `BYPASSRLS`. Server-side only. |

Two properties of the new keys matter here. A secret key carries Postgres' `BYPASSRLS` attribute, so
it ignores row level security entirely. And it **rejects requests whose User-Agent looks like a
browser** with a 401 - a safety net if one ever leaks into a client bundle.

## Which key this workspace uses where

- **`services/back` requires the secret key**, and every database operation it performs uses it.
  This is not a convenience: `devices`, `device_channels`, `update_logs` and `native_update_logs`
  all have RLS enabled, and every policy on them is keyed on an authenticated dashboard user via
  `can_access_app()`. The server builds one client at boot and never forwards a user's JWT to
  Supabase, so a publishable key satisfies no policy and its writes are rejected. Authorisation for
  those routes is enforced in `middleware/auth.ts`, `checkAppAccess` and `checkOrgAccess`, before
  any query is built.

  `config/keys.ts` resolves the key and **refuses to start** without a secret one. That is
  deliberate: the alternative is a server that boots, connects, and silently records nothing - which
  is exactly the failure this exists to prevent - the backend recorded nothing for months. It also
  warns if a publishable key was put in the secret slot, or a secret key in the publishable slot.

- **`apps/dashboard` and `apps/template` use the publishable key.** The dashboard reads
  `VITE_SUPABASE_PUBLISHABLE_KEY` only - it deploys from this workspace, where the environment is
  known. `apps/template` keeps a `VITE_SUPABASE_ANON_KEY` fallback, because an app built from it may
  be shipped by someone whose environment has not migrated. Never put a secret key in a
  `VITE_`-prefixed variable: Vite inlines those into the bundle.

Variable names, new and legacy - the legacy ones are accepted so an environment can be migrated
without a deploy in between:

```
SUPABASE_SECRET_KEY        ← SUPABASE_SERVICE_KEY        (server only)
SUPABASE_PUBLISHABLE_KEY   ← SUPABASE_KEY                (unused server-side)
VITE_SUPABASE_PUBLISHABLE_KEY ← VITE_SUPABASE_ANON_KEY   (clients)
```

`SUPABASE_URL` is not a credential. It ships in every client bundle and every installed app, and
nothing about it changes here.

## Rotating the leaked key - done 2026-08-21

`capucho-back/.env` was committed with a populated `service_role` key - the repository's old name,
before the rename - and the blob is reachable from this repository's history too (the `git subtree`
import commit). Migrating to the new keys was also the rotation, and the step that actually matters
is done: **the legacy keys are disabled in Supabase.**

Disabling and deleting are equivalent for this purpose. Either way the old JWT is refused, which is
what makes the value in git history inert - it opens nothing. Deleting is tidier; disabling is
reversible, so leave them disabled rather than re-enabling if something turns out to still reference
them.

The sequence that was followed, for the next time:

1. **Settings > API Keys > API Keys tab > Create new API keys.** Copy the secret and publishable
   values.
2. **Set them on the host.** Render: `SUPABASE_SECRET_KEY`. Dashboard build:
   `VITE_SUPABASE_PUBLISHABLE_KEY`. Leave the legacy variables in place for now - the backend
   prefers the new names and falls back to the old, so nothing breaks mid-migration.
3. **Redeploy and check the startup log.** No `[config]` warning means both keys resolved from the
   current names. A warning naming `SUPABASE_SERVICE_KEY` means the old value is still the one in
   use.
4. **Remove the legacy variables** from the host environment.
5. **Delete the legacy keys in the dashboard.** This is the step that ends the exposure - until it
   happens, the leaked string is still a valid credential no matter what the environment says.
   Deletion is irreversible.

With step 5 done the value in git history is inert, which is why publishing this repository was
safe. Purging that history is now a tidiness question, not a security one.

## Verifying the RLS assumption

One thing the code cannot determine: whether `scripts/schema.sql` was ever applied to the live
project, or the tables were made by hand. It changes nothing about which key to use - the secret key
is correct either way - but it explains what was failing before:

```sql
select relname, relrowsecurity from pg_class
where relname in ('devices','device_channels','update_logs','native_update_logs');

select count(*) from devices;
```

If `relrowsecurity` is true, RLS was a second wall behind the missing-`devices`-rows problem, and
the switch to the secret key is what gets telemetry writing at all.
