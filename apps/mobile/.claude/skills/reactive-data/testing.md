# Testing data access

The queries run against real SQLite — sql.js, the same dialect `@cavulsqa/mobile-db` uses for its
own tests. No device, no emulator, about a second for the suite.

## The harness

```ts
import { beforeEach, expect, test } from "vite-plus/test";
import { Kysely } from "kysely";
import { Migrator } from "kysely/migration";
import { createSqlJsDialect } from "@cavulsqa/mobile-db/testing";
import { migrations } from "../src/shared/database/migrations.js";
import type { Database } from "../src/shared/database/schema.js";

let db: Kysely<Database>;

beforeEach(async () => {
  db = new Kysely<Database>({ dialect: await createSqlJsDialect() });
  await new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
  }).migrateToLatest();
});
```

A fresh in-memory database per test, with the app's real migrations applied. `Migrator` comes from
`kysely/migration` — the root export is a compile-time error in kysely 0.29.

## What to assert

Type-checking proves the query compiles. These are the things it cannot prove:

- **Arithmetic.** Two lines at quantity 1 and 2 × 1000 cents must total 3000. Write the number.
- **Empty state.** An aggregate over no rows returns `0`, not `null`. `coalesce` is easy to forget
  and the screen shows a blank tile.
- **Joins.** Every joined row actually resolves — product names present, customer attached.
- **Filters.** A search matches on each field it claims to, and returns `[]` for no match.
- **State machines.** A status cycle lands where you expect at each step.
- **Idempotence.** Anything a person can press twice, pressed twice. `seedSampleData` threw
  `UNIQUE constraint failed: tag.label` on the second press and only a test caught it.
- **Missing rows.** A lookup for an id that does not exist returns `null`, and an update against one
  is a no-op rather than a throw.

## The icon test

`tests/icons.test.ts` guards a different silent failure: it reads the framework7-icons ttf and
asserts every name used in `src/` is a real ligature, plus that the five names this app has already
got wrong stay unresolvable. Extend the second list whenever a wrong name gets through.

## Running

```bash
vp test        # from templates/f7-app
```
