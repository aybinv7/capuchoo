import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";

/**
 * The backend and the database do not deploy together.
 *
 * The CLI declares a flavour on every upload, and the column that stores it
 * arrives with migration 008. Deployed in that order, a write that names the
 * column unconditionally fails with 42703 and every publish stops - the same
 * shape as naming a missing column in a select and rejecting every API key,
 * which this project has already shipped once.
 *
 * Read from the source rather than exercised against a database, because there
 * is no database in this suite and the property is textual: no upload path may
 * insert the column without a fallback.
 */
const root = path.resolve(import.meta.dirname, "..");

const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("writing the flavour survives running before migration 008", () => {
  it("both upload paths insert through the tolerant helper", () => {
    const admin = read("controllers/adminController.ts");
    const native = read("controllers/nativeUpdateController.ts");

    expect(admin).toContain('insertTolerantOfFlavour("app_versions"');
    expect(native).toContain("insertTolerantOfFlavour(");
    expect(native).toContain('"native_updates"');
  });

  it("neither path inserts those tables directly any more", () => {
    // A direct insert would carry `flavour` straight into the failing case.
    const admin = read("controllers/adminController.ts");
    const native = read("controllers/nativeUpdateController.ts");

    expect(admin).not.toContain('insert("app_versions", [updateRecord])');
    expect(native).not.toContain('insert("native_updates", [updateRecord])');
  });

  it("the helper recognises both error shapes, and only those", () => {
    const guard = read("services/flavourGuard.ts");

    // PGRST204 is the one that actually happens: PostgREST checks its own schema
    // cache and answers "Could not find the 'flavour' column of 'app_versions'"
    // before the statement reaches PostgreSQL. Matching only 42703 and the
    // PostgreSQL wording let a live publish fail with a 500.
    expect(guard).toContain("42703");
    expect(guard).toContain("PGRST204");
    expect(guard).toMatch(/could not find/i);

    // Anything else must surface: swallowing a real failure would report a
    // successful publish that stored nothing.
    expect(guard).toContain("if (!missingColumn");
  });

  it("resolution falls back when app_identifiers is absent", () => {
    const update = read("services/updateService.ts");

    expect(update).toContain("falling back to apps.app_id");
  });

  it("migration 008 adds every column the code writes", () => {
    const migration = fs.readFileSync(
      path.join(root, "..", "scripts", "migrations", "008_app_identifiers.sql"),
      "utf8",
    );

    for (const table of ["app_versions", "native_updates"]) {
      expect(migration).toMatch(
        new RegExp(`ALTER TABLE ${table}\\s+ADD COLUMN IF NOT EXISTS flavour`),
      );
    }
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS app_identifiers");
  });
});
