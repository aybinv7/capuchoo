import { sql } from "kysely";
import { describe, expect, it } from "vite-plus/test";
import { splitStatements } from "../src/db/sql-script";
import { createTestDatabase } from "./database";

describe("migrations", () => {
  it("apply on an empty database and create every table", async () => {
    const db = await createTestDatabase();
    const tables = await sql<{ table_name: string }>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1
    `.execute(db);
    expect(tables.rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining([
        "users",
        "sessions",
        "apps",
        "channels",
        "bundles",
        "native_builds",
        "devices",
        "device_events",
        "builds",
        "build_events",
        "audit_log",
        "channel_events",
      ]),
    );
    await db.destroy();
  });

  it("refuse a client channel without a base and a lowercase-violating email", async () => {
    const db = await createTestDatabase();
    await expect(
      db
        .insertInto("users")
        .values({ email: "Upper@Example.com", updated_at: new Date() })
        .execute(),
    ).rejects.toThrow();
    await db.destroy();
  });
});

describe("splitStatements", () => {
  it("splits on terminating semicolons only", () => {
    expect(splitStatements("CREATE TABLE a (x int);\nCREATE INDEX b ON a (x);\n")).toEqual([
      "CREATE TABLE a (x int)",
      "CREATE INDEX b ON a (x)",
    ]);
  });
});
