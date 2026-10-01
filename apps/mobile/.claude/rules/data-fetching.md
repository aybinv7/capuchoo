# Reading and writing data

Every read is a reactive query or a deliberate on-demand call. Every write goes through `rdb`. A
third shape — a hand-rolled cache, or a raw write — produces "stale screen, no error, no symptom",
which is the one failure an offline app cannot afford: the user has no network to blame.

## Reads

`useReactiveQuery(fn, { tables, queryKey, debounce })` from `@/shared/database/queries`.

- **`tables` is the invalidation contract.** It must list exactly the tables `fn` reads — no more,
  no less. Under-list and a write to the missing table leaves the screen stale with no error.
  Over-list and an unrelated write re-runs an expensive query for nothing.

  A join means every joined table. `loadOrderDetail` reads the order, its lines, the customer, the
  product names and the customer's tags, so it lists all five. Count the tables in the SQL, not the
  ones you were thinking about.

- **`queryKey` is a process-wide identity built from arguments, not a label.** It is an array, and
  two mounted queries whose keys match await one request and share its result. Framework7 keeps
  pages mounted, so two instances of one screen genuinely coexist — which is exactly why the key
  has to carry what distinguishes them: `["demo:order", orderId]`, never `["demo:order"]`.

  Put every value the query reads in the key. A ref belongs there directly — `["demo:search", term]`
  — and the query re-runs through its own `debounce` when the ref moves, so a filtered screen never
  calls `refetch()` by hand.

- **`debounce`** collapses a burst. A loop of twenty inserts should refetch once, not twenty times.

- Reads may take the database directly: `searchOrders(getDatabase().db, term)`. Repositories take
  the database as a parameter rather than reaching for the singleton, which is what makes them
  testable — `tests/sales.repository.test.ts` runs them against sql.js.

## Writes

Always `rdb`, never `getDatabase().db`:

```ts
await saveOrder(rdb, { customerId, reference, lines });   // announces sales_order, order_line
await saveOrder(getDatabase().db, …);                     // writes, and nothing notices
```

`rdb` wraps Kysely so a mutation publishes the tables it touched on the change bus. A raw write
lands in SQLite and no query hears about it, so the screen keeps showing the old rows until
something unrelated triggers a refetch. There is no error and nothing to see in review.

Anything that must be all-or-nothing goes in one transaction. `saveOrder` writes the order and its
lines together because a half-written order is worse than no order.

## Forbidden

A module-scope `Map` or `ref` holding fetched rows with neither a TTL nor a bus subscription. Once
populated it never refreshes for the session, and the next write is invisible until restart.
In-flight dedup (a `Map<key, Promise>` cleared in `finally`) is concurrency control, not a cache,
and is fine — `useReactiveQuery` already does it.

## Seed and demo helpers

Anything a person can press twice must survive being pressed twice. `seedSampleData` inserts the
catalogue only where missing and upserts tags, because a plain insert threw
`UNIQUE constraint failed: tag.label` on the second press.

## Proof obligations

- A new query: state which tables its SQL touches and that `tables` matches.
- A new write: state that it goes through `rdb`, and whether it needs a transaction.
- Either: a test in `tests/` exercising it against sql.js. Type-checking a query proves nothing
  about what it returns.
