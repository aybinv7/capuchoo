# Schema and migrations

`src/shared/database/schema.ts` is what Kysely type-checks every query against.
`src/shared/database/migrations.ts` is what actually creates the tables. The two are edited
together, always: a field in one and not the other is a runtime error the compiler cannot see.

## Migrations

- Keys are ordered lexically and recorded once applied, so they are **numbered and never renamed**.
  Renaming one makes it run again on a database that already has it.
- Never edit a migration that has shipped. Add the next one.
- A synced table is created with `createTableWithDefaults` when it carries the sync contract, or a
  plain `createTable` when it does not. This template has no server, so plain tables are the norm.
- Declare foreign keys, and index the columns screens filter and join by. Without them every
  dashboard aggregate is a full scan, which you will not notice until the table is large and the
  device is slow.
- SQLite ignores foreign keys unless asked; `PRAGMA foreign_keys = ON` runs at the end of the
  migration. It is per-connection, so a cascade is not something to rely on — `deleteOrder` removes
  the lines explicitly.

## Types

- Money is **integer cents**, named `*_cents`. A float total is a rounding bug waiting for a
  large-enough order.
- Timestamps are ISO strings via `nowISO()`.
- A price copied onto an order line is copied deliberately, so a later catalogue change does not
  rewrite history.

## Getting an inserted id

Use `insertId`, never `.returning(...)`:

```ts
const inserted = await trx.insertInto("sales_order").values({ ... }).executeTakeFirstOrThrow();
const orderId = Number(inserted.insertId ?? 0);
if (!orderId) throw new Error("the order was written but the database reported no id for it");
```

`insertId` is the portable answer. Every engine reports it — the worker engines from
`last_insert_rowid()`, the sql.js test dialect the same way — so a repository written against it
behaves identically in tests and on a device. `.returning(...)` does work on the worker engines, but
it is the one thing that differs between them: the Capacitor plugin runs a statement issued inside an
open transaction through `query()`, which executes it and silently drops its RETURNING rows, so
`.returning("id").executeTakeFirstOrThrow()` threw `no result` from an insert that had in fact
succeeded. `@cavulsqa/mobile-db` now throws a message that says so instead.

## The web path is the device path

Both run the same engine: SQLite compiled to WebAssembly, in a worker, with the database file in
OPFS. There is no Capacitor SQLite plugin in this template and no sql.js outside the tests. So:

- **Browser data survives a reload.** OPFS is durable storage, not memory. Clear it from
  Diagnostics, or through the browser's site-data controls.
- A bug reproduced in the browser is very likely the same bug as on the device, which was not true
  when the two ran different engines.
- `localStorage["app.storage.force"]` pins the chain to one engine id, for comparing them.

What still does not transfer is **timing**. A phone's storage and CPU are nothing like a laptop's,
and the worker is serial either way, so a ratio measured in a browser says nothing about the device.
Run the Diagnostics benchmark on hardware.

## Proof obligations

A schema change needs a test in `tests/` that runs the migration and the affected queries against
sql.js. `tests/sales.repository.test.ts` is the pattern: build a Kysely on `createSqlJsDialect()`,
migrate, then assert on real rows — including the arithmetic. A total that type-checks can still be
computed wrong.

## Writing a lot of rows

Measured on a phone, at 100k rows, per row written:

| how                                              | per row        |
| ------------------------------------------------ | -------------- |
| one insert per statement, each its own commit    | 8-13 ms        |
| one insert per statement, inside one transaction | ~0.45 ms       |
| multi-row insert, ~150 rows per statement        | 0.066-0.115 ms |

Roughly a hundredfold between the worst and best way to write the same row. SQLite caps parameters
per statement, so 150 rows of five columns is about the practical ceiling for one insert - chunk by
parameter budget, not by a round number.

## Why a big write freezes the screen, and what to do

The database runs in one worker, and that worker is serial. A read cannot overtake a write already
in flight; it waits for everything queued ahead of it. So the cost to the UI is not how fast the
write is, it is **how much work the write committed to before the read arrived**.

Time a screen's read waits when it lands during a 1000-row write:

| write strategy                                 | read waits    |
| ---------------------------------------------- | ------------- |
| 1000 single inserts in one transaction         | ~350-690 ms   |
| 150 rows per statement, one transaction        | ~36-53 ms     |
| ten transactions of 100, awaited one at a time | **~21-32 ms** |

A naive loop stalls the screen for most of a second. Chunked transactions bring it under the
threshold anyone notices, and the reason is mechanical: awaiting each chunk means only one chunk is
ever queued, so an arriving read waits for 100 rows instead of 1000.

**So: write in chunks of about a hundred rows, use multi-row inserts inside each chunk, and await
each chunk before starting the next.** Do not wrap a thousand rows in one transaction to be fast -
it is faster in total and far worse for anyone looking at the screen while it runs.

The Diagnostics benchmark measures all three strategies, so this is checkable on any device rather
than taken on faith.
