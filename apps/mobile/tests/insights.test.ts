import { Kysely } from "kysely";
import { Migrator } from "kysely/migration";
import { createSqlJsDialect } from "@cavulsqa/mobile-db/testing";
import { beforeEach, expect, test } from "vite-plus/test";
import { clearCatalog, replaceApps } from "../src/domains/catalog/catalog.repository.js";
import {
  deleteDeviceRow,
  getStats,
  listDevices,
  replaceDevices,
  saveStats,
} from "../src/domains/insights/insights.repository.js";
import { fillDays, versionSlices } from "../src/modules/home/lib/series.js";
import { can } from "../src/shared/access/capabilities.js";
import type { AppStats, ServerDevice } from "../src/shared/api/types.js";
import { migrations } from "../src/shared/database/migrations.js";
import type { Database } from "../src/shared/database/schema.js";
import {
  alignCurrentApp,
  clearCurrentApp,
  currentAppId,
} from "../src/shared/session/currentApp.js";
import { toDevices } from "../src/shared/sync/mappers.js";
import { formatPercent } from "../src/shared/utils/format.js";

let db: Kysely<Database>;

const APP = {
  id: "a1",
  bundle_id: "com.example.field",
  name: "Field",
  organization_id: "o1",
  platform: "all",
  role: "developer" as const,
  prod_role: "admin" as const,
  icon_url: null,
  channel_count: 1,
  device_count: 2,
  native_count: 1,
  bundle_count: 0,
};

const DEVICE: ServerDevice = {
  id: "d1",
  app_id: "a1",
  device_id: "android-1",
  custom_id: null,
  platform: "android",
  is_prod: true,
  is_emulator: false,
  version_name: "1.4.0",
  version_code: 140,
  version_os: "15",
  plugin_version: "8.0.0",
  channel_id: "c1",
  assigned_channel_id: null,
  channel_name: "prod",
  device_name: null,
  manufacturer: "Xiaomi",
  model: "23090RA98G",
  last_seen_at: "2026-10-01T10:00:00Z",
  created_at: "2026-09-01T10:00:00Z",
};

const STATS: AppStats = {
  days: 30,
  totals: { checks: 40, installs: 9, failures: 1, devices: 2, active_24h: 1, success_rate: 0.9 },
  daily: [{ day: "2026-09-30", checks: 40, installs: 9, failures: 1, devices: 2 }],
  versions: [{ version: "1.4.0", platform: "android", devices: 2 }],
  channels: [],
};

beforeEach(async () => {
  db = new Kysely<Database>({ dialect: await createSqlJsDialect() });
  await new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
  }).migrateToLatest();
  await replaceApps(db, [APP]);
});

test("devices are stored as booleans the phone can read, most recently seen first", async () => {
  const older = { ...DEVICE, id: "d2", is_emulator: null, last_seen_at: "2026-09-20T10:00:00Z" };
  await replaceDevices(db, "a1", toDevices([older, DEVICE]));

  const rows = await listDevices(db, "a1");
  expect(rows.map((row) => row.id)).toEqual(["d1", "d2"]);
  expect(rows[0]?.is_prod).toBe(1);
  expect(rows[0]?.is_emulator).toBe(0);
  expect(rows[1]?.is_emulator, "an unreported flag stays unknown, not false").toBeNull();
});

test("a device the server stopped listing is gone after the next sync, and removing one is local", async () => {
  await replaceDevices(db, "a1", toDevices([DEVICE, { ...DEVICE, id: "d2" }]));
  await replaceDevices(db, "a1", toDevices([DEVICE]));
  expect((await listDevices(db, "a1")).map((row) => row.id)).toEqual(["d1"]);

  await deleteDeviceRow(db, "d1");
  expect(await listDevices(db, "a1")).toEqual([]);
});

test("statistics are kept per window and replaced, not duplicated", async () => {
  await saveStats(db, { app_id: "a1", days: 30, payload: JSON.stringify(STATS), synced_at: "t1" });
  await saveStats(db, {
    app_id: "a1",
    days: 30,
    payload: JSON.stringify({ ...STATS, totals: { ...STATS.totals, installs: 10 } }),
    synced_at: "t2",
  });

  const stored = await getStats(db, "a1", 30);
  expect(stored?.syncedAt).toBe("t2");
  expect(stored?.stats.totals.installs).toBe(10);
  expect(await getStats(db, "a1", 7)).toBeNull();
});

test("signing out and losing an app take its devices and statistics with them", async () => {
  await replaceDevices(db, "a1", toDevices([DEVICE]));
  await saveStats(db, { app_id: "a1", days: 30, payload: JSON.stringify(STATS), synced_at: "t" });

  await replaceApps(db, []);
  expect(await listDevices(db, "a1")).toEqual([]);
  expect(await getStats(db, "a1", 30)).toBeNull();

  await replaceApps(db, [APP]);
  await replaceDevices(db, "a1", toDevices([DEVICE]));
  await clearCatalog(db);
  expect(await listDevices(db, "a1")).toEqual([]);
});

test("the chosen app is forgotten when the account loses it, and picked when there is one", () => {
  clearCurrentApp();
  alignCurrentApp(["a1"]);
  expect(currentAppId.value, "a single app needs no choosing").toBe("a1");

  alignCurrentApp(["a1", "a2"]);
  expect(currentAppId.value).toBe("a1");

  alignCurrentApp(["a2", "a3"]);
  expect(currentAppId.value, "a lost app sends the phone back to the picker").toBeNull();
  clearCurrentApp();
});

test("the daily series covers every day of the window, oldest first", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  const days = fillDays(STATS.daily, 3, now);
  expect(days.map((row) => row.day)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01"]);
  expect(days[1]?.installs).toBe(9);
  expect(days[0]?.installs).toBe(0);
});

test("versions merge across platforms and the tail folds into one slice", () => {
  const slices = versionSlices(
    [
      { version: "1.4.0", platform: "android", devices: 6 },
      { version: "1.4.0", platform: "ios", devices: 2 },
      { version: "1.3.0", platform: "android", devices: 1 },
      { version: "1.2.0", platform: "android", devices: 1 },
    ],
    2,
    (count) => `${count} others`,
  );
  expect(slices.map((slice) => [slice.version, slice.devices])).toEqual([
    ["1.4.0", 8],
    ["2 others", 2],
  ]);
  expect(slices[0]?.share).toBeCloseTo(0.8);
});

test("a near-perfect rate never rounds up to 100%", () => {
  expect(formatPercent(0.996)).toBe("99.6%");
  expect(formatPercent(1)).toBe("100%");
  expect(formatPercent(0.5)).toBe("50%");
  expect(formatPercent(null)).toBe("—");
});

test("moving a device follows the target channel's delivery rule; removing needs an admin", () => {
  const developer = { role: "developer" as const, prod_role: "admin" as const };
  expect(can.assignDevice(developer, "staging")).toBe(true);
  expect(can.assignDevice(developer, "prod"), "prod is the admin's here").toBe(false);
  expect(can.assignDevice(developer, undefined), "clearing an override").toBe(true);
  expect(can.removeDevice(developer)).toBe(false);
  expect(can.removeDevice({ role: "admin", prod_role: "admin" })).toBe(true);
  expect(can.assignDevice({ role: "tester", prod_role: "admin" }, "dev")).toBe(false);
});
