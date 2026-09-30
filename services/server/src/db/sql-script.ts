import { sql, type Kysely } from "kysely";

/** Splits a migration script on statement boundaries; scripts must not put `;` inside literals. */
export function splitStatements(script: string): string[] {
  return script
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/** Runs each statement on its own, which every driver (including PGlite) accepts. */
export async function executeStatements(db: Kysely<unknown>, script: string): Promise<void> {
  for (const statement of splitStatements(script)) {
    await sql.raw(statement).execute(db);
  }
}
