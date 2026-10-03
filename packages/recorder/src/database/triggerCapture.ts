import { quoteIdentifier } from "./introspect.js";
import type { DatabaseTable, ExecuteSql, RowChange } from "./types.js";

const LOG = "capuchoo_changes";
const DRAIN_BATCH = 500;
/** json_object takes two arguments per column and SQLite caps a call at 127 by default. */
const COLUMNS_PER_OBJECT = 60;

const literal = (text: string) => `'${text.replace(/'/g, "''")}'`;

function valueOf(reference: string): string {
  return `case typeof(${reference}) when 'blob' then 'x''' || hex(${reference}) || '''' else ${reference} end`;
}

function rowJson(prefix: "NEW" | "OLD", columns: readonly string[]): string {
  const parts: string[] = [];
  for (let start = 0; start < columns.length; start += COLUMNS_PER_OBJECT) {
    const slice = columns.slice(start, start + COLUMNS_PER_OBJECT);
    parts.push(
      `json_object(${slice
        .map((column) => `${literal(column)}, ${valueOf(`${prefix}.${quoteIdentifier(column)}`)}`)
        .join(", ")})`,
    );
  }
  return parts.reduce((merged, part) => `json_patch(${merged}, ${part})`);
}

const triggerName = (table: string, op: string) => quoteIdentifier(`capuchoo_${table}_${op}`);

/**
 * Committed writes with their values on any SQLite engine, through temporary triggers that log into
 * a temporary table. Both live only on the app's connection, vanish with it, and roll back with the
 * transaction that wrote them - so a log row exists exactly when its write committed.
 */
export function createTriggerCapture(
  execute: ExecuteSql,
  onChanges: (changes: RowChange[], at: number) => void,
  onError: (error: unknown) => void,
) {
  let tables: DatabaseTable[] = [];
  let lastSeq = 0;
  let queued = false;
  let chain: Promise<void> = Promise.resolve();

  async function install(next: DatabaseTable[]): Promise<void> {
    await uninstall();
    tables = next.filter((table) => table.columns.length > 0);
    await execute(
      `create temp table if not exists ${LOG} (seq integer primary key autoincrement, tbl text not null, op text not null, old text, new text, at real not null default ((julianday('now') - 2440587.5) * 86400000.0))`,
    );
    for (const table of tables) {
      const columns = table.columns.map((column) => column.name);
      const target = quoteIdentifier(table.name);
      const name = literal(table.name);
      await execute(
        `create temp trigger if not exists ${triggerName(table.name, "insert")} after insert on ${target} begin insert into ${LOG} (tbl, op, new) values (${name}, 'insert', ${rowJson("NEW", columns)}); end`,
      );
      await execute(
        `create temp trigger if not exists ${triggerName(table.name, "update")} after update on ${target} begin insert into ${LOG} (tbl, op, old, new) values (${name}, 'update', ${rowJson("OLD", columns)}, ${rowJson("NEW", columns)}); end`,
      );
      await execute(
        `create temp trigger if not exists ${triggerName(table.name, "delete")} after delete on ${target} begin insert into ${LOG} (tbl, op, old) values (${name}, 'delete', ${rowJson("OLD", columns)}); end`,
      );
    }
    const [row] = await execute(`select coalesce(max(seq), 0) as seq from ${LOG}`);
    lastSeq = Number(row?.seq ?? 0);
  }

  async function uninstall(): Promise<void> {
    for (const table of tables) {
      for (const op of ["insert", "update", "delete"]) {
        await execute(`drop trigger if exists temp.${triggerName(table.name, op)}`).catch(() => []);
      }
    }
    tables = [];
    await execute(`drop table if exists temp.${LOG}`).catch(() => []);
  }

  const parse = (text: unknown): Record<string, unknown> | null => {
    if (typeof text !== "string") return null;
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  async function drainOnce(): Promise<RowChange[]> {
    const changes: RowChange[] = [];
    for (;;) {
      const rows = await execute(
        `select seq, tbl, op, old, new, at from ${LOG} where seq > ? order by seq limit ?`,
        [lastSeq, DRAIN_BATCH],
      );
      if (rows.length === 0) break;
      for (const row of rows) {
        changes.push({
          table: String(row.tbl),
          op: row.op === "delete" ? "delete" : row.op === "update" ? "update" : "insert",
          old: parse(row.old),
          new: parse(row.new),
        });
      }
      lastSeq = Number(rows[rows.length - 1]!.seq);
      await execute(`delete from ${LOG} where seq <= ?`, [lastSeq]);
      if (rows.length < DRAIN_BATCH) break;
    }
    return changes;
  }

  return {
    install,
    uninstall,
    /** Reads what was logged since the last read; at most one read waits behind the running one. */
    requestDrain(): void {
      if (queued || tables.length === 0) return;
      queued = true;
      chain = chain
        .then(async () => {
          queued = false;
          const changes = await drainOnce();
          if (changes.length > 0) onChanges(changes, Date.now());
        })
        .catch(onError);
    },
    settled(): Promise<void> {
      return chain;
    },
  };
}
