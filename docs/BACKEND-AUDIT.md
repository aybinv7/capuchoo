# Backend audit

A second pass over `services/back` and `apps/dashboard`, after the migration recorded in
[AUDIT.md](./AUDIT.md). It answers one question: why the dashboard showed **no devices and no logs,
ever**, even though updates were being delivered successfully.

The root cause and the defects stacked on it are fixed. What is left needs either a decision or a
schema change, and is listed at the bottom.

---

## 1. The `devices` table was never written to

`scripts/schema.sql` defines `devices` with every field the dashboard wants. Nothing in the backend
inserted, updated or upserted it - the string `insert("devices"` appeared nowhere in `src/`.

Every other telemetry table points at it:

```sql
device_channels.device_id      UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE
update_logs.device_id          UUID          REFERENCES devices(id) ON DELETE SET NULL
native_update_logs.device_id   UUID          REFERENCES devices(id) ON DELETE SET NULL
```

`devices` empty -> every foreign key reference fails -> `supabaseService.insert()` throws -> zero
rows, permanently. On `/api/stats` that throw became a 500 the plugin discards silently, which is
why there was no error to notice either.

Stacked on top: the code passed `request.deviceId` - the _plugin's string identifier_ - into a
column typed `UUID` holding `devices.id`, a server-generated key. Two different identifiers
conflated, so even a populated `devices` table would not have saved those inserts.

**Now:** `services/deviceService.ts` owns the mapping. `registerDevice()` upserts on
`(app_id, device_id)` and returns the row, and it is the only place that turns a plugin device
string into a `devices.id`. `services/telemetry.ts` holds the pure part - which columns a given
observation may write - and is unit tested.

Two supporting changes:

- `supabaseService.upsert()` is new. It writes only the keys it is given, so a stats call that knows
  the platform and version cannot blank the channel a channel-assignment stored, and vice versa.
- `scripts/migrations/004_devices.sql` creates the table if a hand-assembled database never got it,
  and adds the two unique constraints the upserts key on (`devices(app_id, device_id)` and
  `device_channels(device_id, channel_id)`). Without those, `ON CONFLICT` has no target and every
  write fails. It is idempotent.

## 2. Device state was recorded on the rarest possible outcome

The old write sat inside `if (request.deviceId)` on the _successful OTA delivery_ path. A device
that was already up to date, or on a channel with no bundle, or blocked by `min_update_version`,
returned earlier and was never recorded.

**Now:** the device is upserted immediately after the channel and environment checks pass, so every
`/api/update` call records the device that made it.

## 3. The device row was insert-only

```ts
if (!existing) {
  insert("device_channels", [...]);
} // no else
```

Once a device was seen, nothing about it was ever written again - so `updated_at` froze at first
contact and `last_check` could never work.

**Now:** an upsert on both `devices` and `device_channels`, bumping `last_seen`/`updated_at` on
every sighting.

## 4. Received fields were thrown away

The dashboard's `Device` type declares 20 fields. Four were ever written:
`{ device_id, channel_id, platform, updated_at }`. The updater already sends `versionCode`,
`version_name` and `isProd` on every check; `statsController` received them and then forwarded only
`version` to `logStats`.

**Now:** `platform`, `version_name`, `version_build`, `version_os`, `plugin_version`, `is_prod`,
`is_emulator`, `channel_id`, `channel_override`, `custom_id` and `last_seen` are all persisted when
the caller knows them. `"builtin"` and `"unknown"` are rejected rather than stored as versions - the
plugin's sentinel for "running the version shipped in the binary" is not a version.

## 5. `logStats` filed every device under a channel named `prod`

```ts
.from("channels").eq("name", "prod")    // hard-coded
```

Devices were bound to whatever channel was literally named `prod`, regardless of the channel serving
them. An app with no such channel registered **no devices at all**. Lowmaro has one, bound to
staging, so every Lowmaro device was filed under `prod`.

**Now:** the channel the caller reports, else the binding already on the device row. No literal.

## 6. `logStats` wrote `"unknown"` as the version, always

It read `stats.version_name`. The field normalizer maps the plugin's `version_name` to `version`,
and `statsController` forwarded only `version` - so `version_name` was undefined on that path and
the `|| "unknown"` fallback fired every time. It also never wrote `current_version`, which
`/api/update` writes to the same column, so stats-derived rows had no "upgrading from".

**Now:** `statsVersion()` reads `version_name`, then `version`, then `bundleId`, and
`current_version` comes from `oldVersionName`. Both behaviours are pinned by tests.

## 7. `/api/downloaded`, `/api/applied` and `/api/failed` wrote rejected rows

They sent `status: "downloaded" | "applied" | "failed"`. `update_logs.action` has a CHECK constraint
(migration `003`) and none of those three are among its values, so every row was rejected even
before the foreign key failed.

**Now:** `download_complete`, `install`, `update_failed` - values the constraint allows.

## 8. `/api/native-updates/log` could never have worked

`native_update_logs.app_id` is `NOT NULL` and the handler never sent it. Its `device_id` got the
plugin's string. And the `device_channels` insert beside it sent `app_id` and `channel` - two
columns that table does not have.

**Now:** the app UUID is resolved, the device is registered through `deviceService`, and the channel
binding goes through `linkChannel()`. This endpoint is what `@capucho/updater` calls, so its native
telemetry was also landing nowhere.

## 9. Telemetry could break an update

`insert()` throws, and nothing caught it - so a bookkeeping failure surfaced as a 500 from
`/api/update` and the device got no update at all.

**Now:** every telemetry write is best-effort: logged on failure, never thrown. Delivering the
update outranks recording that it happened.

## 10. A channel named `prod` could silently serve staging bundles

`environment` decides which `.env` flavour the CLI builds and which bundles the server hands out.
The channel's _name_ is only an identifier, and nothing linked the two - while the dashboard
defaulted the field to `"staging"` in both places that set it:

```ts
environment: "staging" as const,              // pages/channels/create.vue
environment: newChannel.environment || "staging",  // pages/channels/[id].vue
```

Create a channel called **prod** without opening that dropdown and production devices received
staging bundles. That is how all three of Lowmaro's channels ended up on staging.

**Now:** no default in either place. `modules/channels/utils/environment.ts` derives the environment
a name implies, fills it in while the user has not chosen one, and warns - without blocking - when
the name and the selection disagree, because a prod app pointed at a staging channel is a legitimate
beta setup. Submitting with no environment chosen is refused: the field is a Select, so the form's
`required` never covered it. Nine tests cover the name matching, which is deliberately whole-name -
`prod-eu` could be either, and guessing at substrings would warn about names it cannot reason about.

## 11. The server did all of its writes with the `anon` key

`supabaseService` built two clients: `storageClient` from `SUPABASE_SERVICE_KEY`, and `client` from
`SUPABASE_KEY` - which is the **`anon`** key (confirmed from the `role` claim of the leaked value).
`client` performed 62 of the 70 database operations in this service, including every write.

`schema.sql:428-431` enables row level security on `devices`, `device_channels`, `update_logs` and
`native_update_logs`, and every policy on them is keyed on an authenticated dashboard user via
`can_access_app()`. This process builds one client at boot and never forwards a user's JWT to
Supabase, so an anonymous client can satisfy none of them. Where RLS is on, those writes are
rejected

- a second wall standing behind the missing-`devices`-rows problem above, and one that would have
  kept the fix from working.

**Now:** both clients use the secret key, which carries `BYPASSRLS`. Authorisation for these routes
is enforced in `middleware/auth.ts`, `checkAppAccess` and `checkOrgAccess`, before any query is
built

- a trusted server holding a privileged key is the model this design already assumed.

Alongside it, the workspace moved to Supabase's current API keys - `sb_publishable_…` and
`sb_secret_…` - because `anon` and `service_role` are deprecated with removal announced for the end
of 2026. `config/keys.ts` accepts both namings, refuses to start with no secret key rather than
booting into a server that records nothing, and warns when a key looks wrong for its slot. See
[SUPABASE-KEYS.md](./SUPABASE-KEYS.md) for the rotation runbook.

---

## Verified

- `vp run -r build` clean, all 12 tasks, including `vue-tsc` over the dashboard.
- 30 new unit tests - 10 over `telemetry.ts`, 11 over `config/keys.ts`, 9 over the dashboard's
  environment helper. `vp run -r test` is 120 across the workspace.
- `vp lint services/back apps/dashboard` reports only the pre-existing warnings listed in AUDIT.md.

**Not verified against a live database.** These are the first writes this schema has ever received,
and one question remains open: whether `schema.sql` was ever applied to the live Supabase, or the
tables were made by hand. `select count(*) from devices;` in the SQL editor answers it. Run
`004_devices.sql` before deploying either way - it is idempotent, and if `devices` already exists it
only adds the constraints the upserts need.

## Open, needing a decision

1. **The dashboard cannot upload an OTA bundle.** It calls `POST /api/admin/native-upload` (APK) but
   never `POST /api/admin/upload` (web bundle), so web updates are CLI-only while native updates
   have both paths. The `/updates-bundles/upload` page wires only the native mutation.
2. **Enriching the check payload.** `getPluginVersion()`, `getBuiltinVersion()` and `getChannel()`
   are all available from the capgo plugin, and OS version / model / emulator flag from
   `@capacitor/device` - which `apps/template` already depends on, though Lowmaro does not. The
   backend now persists these the moment they arrive; nothing sends them yet.
3. **Eleven dead endpoints**, including a full duplicate app-management API (`/api/dashboard/apps*`
   vs `/api/apps`, plus `/api/apps/:id/channels|releases` duplicating
   `/dashboard/channels|bundles`). Two parallel APIs over the same tables will drift. Deleting them
   is a decision about the CLI's compatibility surface, not a fix.
