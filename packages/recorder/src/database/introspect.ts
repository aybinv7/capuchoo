import type { DatabaseColumn, DatabaseTable, ExecuteSql } from "./types.js";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$]*$/;

export const quoteIdentifier = (name: string) => `"${name.replace(/"/g, '""')}"`;

export async function listTables(execute: ExecuteSql): Promise<string[]> {
  const rows = await execute(
    "select name from sqlite_schema where type = 'table' and name not like 'sqlite_%' and name not like 'capuchoo_%' order by name",
  );
  return rows.map((row) => String(row.name)).filter((name) => IDENTIFIER.test(name));
}

export async function describeTables(
  execute: ExecuteSql,
  tables: string[] | "all",
): Promise<DatabaseTable[]> {
  const names = tables === "all" ? await listTables(execute) : tables;
  const described: DatabaseTable[] = [];
  for (const name of names) {
    if (!IDENTIFIER.test(name)) continue;
    const rows = await execute("select name, type, pk from pragma_table_info(?)", [name]);
    if (rows.length === 0) continue;
    const columns: DatabaseColumn[] = rows.map((row) => ({
      name: String(row.name),
      type: String(row.type ?? ""),
      pk: Number(row.pk ?? 0),
    }));
    described.push({ name, columns, tracked: columns.some((column) => column.pk > 0) });
  }
  return described;
}
