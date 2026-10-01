import { afterEach, expect, test, vi } from "vite-plus/test";
import { storageChain } from "../src/app/storage.config.js";
import { closeDatabase, openDatabase } from "../src/shared/database/database.js";

afterEach(async () => {
  await closeDatabase();
  vi.restoreAllMocks();
});

/**
 * Nothing in this environment can open a database, which is the point: what is under test is how
 * many times the chain gets walked, not whether it succeeds.
 *
 * The guard used to be `if (database) return database` - a value, not a promise - so two callers in
 * the same tick both walked it. The pool VFSes take their OPFS directory exclusively, so the second
 * walk collided with the first, retried, failed, and fell through to a slower engine that the app
 * then reported as its choice.
 */
test("concurrent callers share one walk of the chain", async () => {
  const probes = storageChain.map((candidate) => vi.spyOn(candidate, "probe"));

  const [first, second] = await Promise.allSettled([openDatabase(), openDatabase()]);

  expect(first.status).toBe("rejected");
  expect(second.status).toBe("rejected");

  for (const [index, probe] of probes.entries()) {
    expect(probe, storageChain[index]?.id).toHaveBeenCalledTimes(1);
  }
});

test("a caller arriving after a failed walk gets a fresh attempt", async () => {
  await expect(openDatabase()).rejects.toThrow(/No storage engine could open the database/);

  const probes = storageChain.map((candidate) => vi.spyOn(candidate, "probe"));
  await expect(openDatabase()).rejects.toThrow(/No storage engine could open the database/);

  // Memoising the promise must not memoise the failure: a retry has to be able to try again.
  for (const probe of probes) expect(probe).toHaveBeenCalledTimes(1);
});

test("the failure names every candidate and why it was passed over", async () => {
  const failure = await openDatabase().then(
    () => null,
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  );

  // "the database would not open" on its own helps nobody: every attempt has to say what happened.
  expect(failure).toBeTruthy();
  for (const candidate of storageChain) {
    expect(failure).toContain(candidate.id);
  }
  expect(failure).toContain("unsupported");
});
