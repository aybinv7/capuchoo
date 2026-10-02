# Devices

What a device tells the server, what the dashboard shows of it, and the attributes an app attaches
so a tester can tell whose tablet is whose.

## What a device reports

- **Each update check** (`POST /api/update`) upserts the `devices` row: versions, OS, model,
  channel, memory, optional location, and the device's **attributes** when the app set some.
- **Each event** (`POST /api/stats`, `POST /api/native-updates/log`) becomes a `device_events` row:
  checks, downloads, deliveries, failures, rollbacks, lifecycle. They are classified by
  `classifyUpdateEvent` in core (`check`, `downloading`, `delivered`, `failed`, `cancelled`,
  `lifecycle`, `other`) and kept `DEVICE_EVENT_RETENTION_DAYS` days.
- **Attributes on their own** (`POST /api/device_attributes`) - sent the moment the app sets them,
  so a tester sees the signed-in user without waiting for the next check.

## Attributes

App-defined key/value pairs, set from the app with `@capuchoo/updater`:

```ts
import { setDeviceAttributes, clearDeviceAttributes } from "@capuchoo/updater";

await setDeviceAttributes({ rep: "K. Haddad", employeeId: "E-1042", route: "Oran West" });
await setDeviceAttributes({ route: null }); // removes one key
await clearDeviceAttributes(); // on sign-out
```

Limits (`DEVICE_ATTRIBUTE_LIMITS` in core): 20 keys; a key starts with a letter and is at most 40
characters of letters, digits, `_`, `.`, `-`; a value is a string (at most 200 characters), a finite
number or a boolean; 4 KiB in all. Anything else is dropped, never stored half-valid.

**These are often personal data.** A name, a phone number or an employee id identifies a person, and
Law 18-07 applies to storing it. Prefer an opaque id the team can look up over a name or a phone
number, never send credentials, and clear the attributes on sign-out. Attributes are visible to
every member of the app, are searchable, and are deleted with the device.

## API

| Method | Path                                                                         | Who    | Answer                                                                  |
| ------ | ---------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| GET    | `/api/apps/:id/devices?search=&channel_id=&active_days=`                     | viewer | `{ devices: Device[], total }` - `search` also matches attribute values |
| GET    | `/api/devices/:id`                                                           | viewer | `DeviceDetail`                                                          |
| GET    | `/api/devices/:id/events?before=&limit=&category=&from=&to=`                 | viewer | `{ events: DeviceEvent[], next: string \| null }`                       |
| GET    | `/api/devices/:id/activity?from=&to=&bucket=&tz=`                            | viewer | `DeviceActivity`                                                        |
| GET    | `/api/apps/:id/device-events?before=&limit=&category=&channel_id=&from=&to=` | viewer | `{ events: Array<DeviceEvent & { device: DeviceRef \| null }>, next }`  |
| POST   | `/api/device_attributes`                                                     | device | `{ app_id, device_id, attributes }` -> `{ status, attributes }`         |

```ts
interface Device {
  // ...existing columns...
  attributes: Record<string, string | number | boolean> | null;
  attributes_updated_at: string | null;
}

interface DeviceDetail extends Device {
  retention_days: number;
  channel: { id: string; name: string; environment: string } | null;
  assigned_channel: { id: string; name: string } | null;
  summary: {
    days: 30;
    checks: number;
    delivered: number;
    failed: number;
    last_delivered: { version: string | null; at: string } | null;
    last_failure: { action: string; error: string | null; at: string } | null;
  };
}

interface DeviceActivity {
  from: string; // ISO instant, inclusive
  to: string; // ISO instant, exclusive
  bucket: "hour" | "day";
  tz: string; // IANA zone the buckets were cut in
  totals: Record<DeviceEvent["category"], number>;
  /** Only buckets with events; the client zero-fills. `at` is the bucket's local start in `tz`. */
  series: Array<{ at: string } & Partial<Record<DeviceEvent["category"], number>>>;
}

interface DeviceEvent {
  id: string;
  kind: "ota" | "native" | "check";
  action: string;
  category: "check" | "downloading" | "delivered" | "failed" | "cancelled" | "lifecycle" | "other";
  status: string | null;
  version_from: string | null;
  version_to: string | null;
  version_code_to: number | null;
  error: string | null;
  channel_id: string | null;
  channel_name: string | null;
  created_at: string;
}

interface DeviceRef {
  id: string;
  device_id: string;
  custom_id: string | null;
  device_name: string | null;
  model: string | null;
  attributes: Record<string, string | number | boolean> | null;
}
```

`before` is an opaque cursor from `next`. `limit` defaults to 100, at most 500. An unknown
`category` is a 400, not an empty page. `from` (inclusive) and `to` (exclusive) are ISO instants;
either may be omitted.

`activity` requires `from` and `to`, at most 366 days apart; `bucket` is `day` (default) or `hour`,
and `hour` is refused beyond 7 days. `tz` is an IANA zone (default `UTC`) so "today" and day
boundaries are the viewer's, not the server's. `at` is `YYYY-MM-DD` for days and `YYYY-MM-DDTHH` for
hours, local to `tz`. `DeviceDetail` also carries `retention_days`, the oldest a range can usefully
start.

## Where the plugin's statistics show

Every event the plugin sends lands in two places: the device's own timeline on its detail page, and
the app-wide **Activity** feed, which lists every device's events newest first and filters by
category and channel. The Statistics page shows the same events aggregated.

## Behaviour worth knowing

- An update check carries the attributes whenever the app has ever set them, `{}` included, so a
  clear that never reached the server is still applied by the next check. A check that omits them
  keeps what is stored.
- `setDeviceAttributes` saves locally first and sends without waiting. A 404 (the device has not
  checked in yet) and a network failure are both left to the next check to reconcile.
- Patches are applied in call order, so two quick calls never lose a key.
