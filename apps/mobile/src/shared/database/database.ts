import { Kysely, sql, type Dialect } from "kysely";
import { Migrator } from "kysely/migration";
import { runWrite, type MobileDatabase } from "@cavulsqa/mobile-db";
import { createChangeBus, createReactiveDb } from "@cavulsqa/reactive-db";
import { pragmaProfile, pragmasFor } from "@/app/pragmas.config";
import { preferredEngine, storageChain } from "@/app/storage.config";
import { isStorageId, type StorageAttempt, type StorageCandidate } from "./candidates";
import { migrations } from "./migrations";
import { describeOpenFailure } from "./storage";
import type { Database } from "./schema";

/** Writes and reactive queries must share one instance, so it is created here and passed outward. */
export const changeBus = createChangeBus<Database>();

const RETRY_DELAY_MS = 400;

let database: MobileDatabase<Database> | null = null;
let opening: Promise<MobileDatabase<Database>> | null = null;
let chosen: StorageCandidate | null = null;
let attempts: StorageAttempt[] = [];
let applied: readonly string[] = [];

interface OpenedDatabase {
  handle: MobileDatabase<Database>;
  pragmas: readonly string[];
}

/**
 * Wraps a Kysely instance in the shape the app consumes, and runs the migrations. Shared by every
 * candidate: they differ in how bytes reach storage and in nothing above it, which is what makes the
 * chain swappable at all.
 */
async function fromDialect(candidate: StorageCandidate, dialect: Dialect): Promise<OpenedDatabase> {
  const db = new Kysely<Database>({ dialect });

  // Before the migrations, and identically for every engine - see pragmas.config.ts for why.
  const pragmas: string[] = [];
  for (const pragma of pragmasFor(pragmaProfile)) {
    try {
      await sql.raw(pragma).execute(db);
      pragmas.push(pragma);
    } catch (error) {
      // A VFS that refuses a journal mode is worth knowing about, not worth failing over.
      pragmas.push(`${pragma} -> rejected: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  // `migrateToLatest` reports failure in its return value rather than throwing, so an unchecked
  // call boots an app whose tables were never created - it surfaced as "no such table" much later.
  const migration = await new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
  }).migrateToLatest();

  if (migration.error) {
    const failed = migration.results?.find((result) => result.status === "Error")?.migrationName;
    // kysely types the error as unknown, and a non-Error would stringify to [object Object].
    const detail =
      migration.error instanceof Error ? migration.error.message : JSON.stringify(migration.error);
    throw new Error(`migration failed${failed ? ` at ${failed}` : ""}: ${detail}`);
  }

  return {
    pragmas,
    handle: {
      db,
      write: (ctx, work) =>
        runWrite(ctx, () => db.transaction().execute((trx) => work(trx)), {
          runInTransaction: <R>(task: () => Promise<R>) => task(),
          emitTableChange: (table) => changeBus.emit(table, "bulk"),
        }),
      close: () => db.destroy(),
    },
  };
}

/** Which candidate the open database is using, for anything that reports or measures. */
export function activeStorage(): StorageCandidate {
  if (!chosen) throw new Error("openDatabase() must be awaited before the storage is known");
  return chosen;
}

export function activeStorageLabel(): string {
  return activeStorage().label;
}

/** The PRAGMAs that actually took, so a measurement can state its own configuration. */
export function activePragmas(): readonly string[] {
  return applied;
}

/** Every step of the walk, including the candidates that were skipped and why. */
export function storageAttempts(): readonly StorageAttempt[] {
  return attempts;
}

// Every step is recorded, because a silent fallback to a slower engine gets discovered weeks later
// by someone wondering why the app is slow.
const FORCE_KEY = "app.storage.force";

/**
 * Pins the chain to one candidate for benchmarking: the *only* one tried, not merely promoted, since
 * a benchmark that fell through to another engine would report the wrong engine's numbers.
 */
function forcedChain(): StorageCandidate[] {
  let forced: string | null = null;
  try {
    forced = localStorage.getItem(FORCE_KEY);
  } catch {
    // Storage disabled; the full chain is the right answer anyway.
  }
  if (!forced || !isStorageId(forced)) return storageChain;

  const pinned = storageChain.find((candidate) => candidate.id === forced);
  return pinned ? [pinned] : storageChain;
}

/**
 * Memoised on the promise, not the result. Two callers in the same tick both passed a `if (database)`
 * guard and both walked the chain - and since the pool VFSes hold their OPFS directory exclusively,
 * the second collided with the first and fell through to a slower engine the app then reported as
 * its choice.
 */
export function openDatabase(): Promise<MobileDatabase<Database>> {
  if (database) return Promise.resolve(database);
  opening ??= walkStorageChain();
  return opening;
}

async function walkStorageChain(): Promise<MobileDatabase<Database>> {
  try {
    return await tryEveryCandidate();
  } finally {
    opening = null;
  }
}

async function tryEveryCandidate(): Promise<MobileDatabase<Database>> {
  if (!storageChain.length) throw new Error("storageChain is empty: nothing can open the database");

  attempts = [];

  const chain = forcedChain();

  for (const candidate of chain) {
    const probe = candidate.probe();
    if (!probe.supported) {
      attempts.push({ id: candidate.id, outcome: "unsupported", detail: probe.reason });
      continue;
    }

    try {
      const opened = await openCandidate(candidate);
      database = opened.handle;
      applied = opened.pragmas;
      chosen = candidate;
      attempts.push({ id: candidate.id, outcome: "opened" });
      // Every launch names its engine. A preference that never arrived - a `.env` the build could
      // not parse, a typo - otherwise looks exactly like one that was applied, and the app reports
      // an engine nobody chose.
      console.info(
        `[storage] opened on ${candidate.id}` +
          (preferredEngine ? ` (VITE_STORAGE_ENGINE=${preferredEngine})` : " (no preference set)"),
        attempts,
      );
      return database;
    } catch (error) {
      attempts.push({ id: candidate.id, outcome: "failed", detail: describeOpenFailure(error) });
    }
  }

  // Every candidate's reason, because "the database would not open" on its own helps nobody.
  const summary = attempts
    .map(
      (attempt) =>
        `${attempt.id}: ${attempt.outcome}${attempt.detail ? ` - ${attempt.detail}` : ""}`,
    )
    .join("; ");
  throw new Error(`No storage engine could open the database. ${summary}`);
}

/**
 * One retry, because the usual reason a pool VFS's directory lock is held is a process on its way out
 * - its handles are released when that process dies, so the same open succeeds a moment later. Past
 * one, the chain moving on is the better answer.
 */
async function openCandidate(candidate: StorageCandidate): Promise<OpenedDatabase> {
  try {
    return await fromDialect(candidate, await candidate.createDialect());
  } catch (first) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    try {
      return await fromDialect(candidate, await candidate.createDialect());
    } catch {
      // The first error is the honest one; the retry's is a duplicate of it.
      throw first;
    }
  }
}

export function getDatabase(): MobileDatabase<Database> {
  if (!database) throw new Error("openDatabase() must be awaited before the database is used");
  return database;
}

/** Writes go through this so every mutation announces its tables without the caller remembering. */
export const rdb = createReactiveDb<Database>({
  getDb: () => getDatabase().db,
  emitChange: changeBus.emit,
});

export async function closeDatabase(): Promise<void> {
  await database?.close();
  database = null;
  opening = null;
  chosen = null;
  attempts = [];
  applied = [];
}
