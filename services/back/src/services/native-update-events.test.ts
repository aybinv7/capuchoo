/**
 * The event vocabulary, checked against the database that has to accept it.
 *
 * `native_update_logs.event` carries a CHECK constraint. It was written with
 * one set of names and `@capuchoo/core` declared another, and nothing compared
 * them - so three of the six events the runtime can send were rejected outright
 * by Postgres. `download_complete` is sent after every native download, which
 * made it the single most common event this endpoint received and a guaranteed
 * 500.
 *
 * It was invisible for two reasons, both worth naming: the app runtime catches
 * a failed telemetry post and only warns to a WebView console, and the failure
 * itself was masked by an earlier 400 that stopped the request before it ever
 * reached the insert.
 *
 * This reads the migration rather than restating it, so the schema is the thing
 * being asserted against and not a copy of it.
 */

import { readFileSync } from "node:fs";
import { UPDATE_EVENTS } from "@capuchoo/core";
import { describe, expect, it } from "vite-plus/test";

const MIGRATION = "scripts/migrations/006_native_update_log_events.sql";

function allowedByMigration(): string[] {
  const sql = readFileSync(new URL(`../../${MIGRATION}`, import.meta.url), "utf8");

  // Comments first. The migration quotes the *old* constraint in its own
  // header to explain what it replaces, and matching that instead of the
  // statement made this pass while asserting the very list it exists to fix.
  const statements = sql.replaceAll(/--[^\n]*/g, "");

  const constraint = /event\s+IN\s*\(([\s\S]*?)\)/i.exec(statements);
  if (!constraint) throw new Error(`no "event IN (...)" constraint found in ${MIGRATION}`);

  return [...constraint[1]!.matchAll(/'([^']+)'/g)].map((match) => match[1]!);
}

describe("native update log events", () => {
  it.each([...UPDATE_EVENTS])("the database accepts %s", (event) => {
    expect(allowedByMigration()).toContain(event);
  });

  // Rows written under the old vocabulary must stay valid, or the constraint
  // cannot be applied to a table that already has data in it.
  it.each(["fail", "skip"])("keeps the historical value %s", (event) => {
    expect(allowedByMigration()).toContain(event);
  });

  it("allows nothing the contract does not define, beyond those two", () => {
    const historical = new Set(["fail", "skip"]);
    const declared = new Set<string>(UPDATE_EVENTS);

    const extra = allowedByMigration().filter(
      (event) => !declared.has(event) && !historical.has(event),
    );

    expect(extra).toEqual([]);
  });
});
