import { Kysely } from "kysely";
import { Migrator } from "kysely/migration";
import { createSqlJsDialect } from "@cavulsqa/mobile-db/testing";
import { beforeEach, expect, test } from "vite-plus/test";
import {
  countUnread,
  listActivity,
  markAllRead,
  recordActivity,
} from "../src/domains/activity/activity.repository.js";
import {
  listAppRows,
  listChannels,
  listNatives,
  replaceAppDetail,
  replaceApps,
  setAppNotify,
} from "../src/domains/catalog/catalog.repository.js";
import { migrations } from "../src/shared/database/migrations.js";
import type { Database } from "../src/shared/database/schema.js";

let db: Kysely<Database>;

const APP = {
  id: "a1",
  bundle_id: "com.example.field",
  name: "Field",
  organization_id: "o1",
  platform: "all",
  role: "tester" as const,
  prod_role: "admin" as const,
  icon_url: null,
  channel_count: 1,
  device_count: 0,
  native_count: 1,
  bundle_count: 0,
};

beforeEach(async () => {
  db = new Kysely<Database>({ dialect: await createSqlJsDialect() });
  await new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
  }).migrateToLatest();
});

test("replacing apps keeps the phone's notify choice and drops what the account lost", async () => {
  await replaceApps(db, [APP, { ...APP, id: "a2", bundle_id: "com.example.other", name: "Other" }]);
  await setAppNotify(db, "a1", false);
  await replaceAppDetail(
    db,
    "a2",
    {
      identifiers: [{ app_id: "a2", bundle_id: "com.example.other", flavour: null }],
      channels: [
        {
          id: "c2",
          app_id: "a2",
          name: "prod",
          environment: "prod",
          kind: "release",
          base_channel_id: null,
          paused: 0,
          current_native_id: null,
          current_bundle_id: null,
          updated_at: "2026-10-01T00:00:00Z",
        },
      ],
      natives: [],
      bundles: [],
    },
    "2026-10-01T00:00:00Z",
  );

  await replaceApps(db, [{ ...APP, name: "Field renamed" }]);

  const apps = await listAppRows(db);
  expect(apps.map((app) => [app.id, app.name, app.notify])).toEqual([["a1", "Field renamed", 0]]);
  expect(await listChannels(db)).toEqual([]);
});

test("an app's detail is replaced whole, newest build first", async () => {
  await replaceApps(db, [APP]);
  const native = (id: string, code: number) => ({
    id,
    app_id: "a1",
    version_name: `1.0.${code}`,
    version_code: code,
    flavour: null,
    size_bytes: 10,
    checksum: null,
    signed: 1,
    signing_cert_sha256: null,
    required: 0,
    release_notes: null,
    min_sdk: 26,
    channels: "[]",
    created_at: "2026-10-01T00:00:00Z",
  });
  const detail = {
    identifiers: [],
    channels: [],
    natives: [native("n1", 1), native("n2", 2)],
    bundles: [],
  };
  await replaceAppDetail(db, "a1", detail, "2026-10-01T00:00:00Z");
  await replaceAppDetail(
    db,
    "a1",
    { ...detail, natives: [native("n2", 2), native("n3", 3)] },
    "2026-10-01T01:00:00Z",
  );
  expect((await listNatives(db, "a1")).map((row) => row.version_code)).toEqual([3, 2]);
});

test("activity is recorded once per fact, joined to its app, and read in one write", async () => {
  await replaceApps(db, [APP]);
  const row = {
    id: "build:n1",
    app_id: "a1",
    kind: "build" as const,
    version_name: "1.0.0",
    version_code: 1,
    channel_name: null,
    environment: null,
    detail: null,
    created_at: "2026-10-01T00:00:00Z",
    read_at: null,
  };
  expect(await recordActivity(db, [row])).toBe(1);
  expect(await recordActivity(db, [row])).toBe(0);
  expect(await countUnread(db)).toBe(1);
  expect((await listActivity(db))[0]?.app_name).toBe("Field");
  await markAllRead(db, "2026-10-01T01:00:00Z");
  expect(await countUnread(db)).toBe(0);
});
