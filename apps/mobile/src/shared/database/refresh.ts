import { changeBus } from "./database";
import type { Database } from "./schema";

/**
 * Asks every visible query reading these tables to read again, through the same bus a write
 * announces on. Nothing is written: SQLite already holds the truth and the screens are live, so
 * today this re-reads it. When a sync exists, a pull-to-refresh runs the sync first and its
 * writes announce themselves.
 */
export function refreshTables(tables: readonly (keyof Database)[]): void {
  for (const table of tables) changeBus.emit(table, "bulk");
}
