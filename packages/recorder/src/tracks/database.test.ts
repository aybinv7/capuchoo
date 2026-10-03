import { describe, expect, it, vi } from "vite-plus/test";
import type { DatabaseSource } from "../database/types.js";
import type { TrackContext } from "../recorder/types.js";
import { createDatabaseTrack } from "./database.js";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function harness() {
  const pushed: Array<{ kind: string; data: Record<string, unknown> }> = [];
  const context: TrackContext = {
    push: (kind, data) => pushed.push({ kind, data: data as Record<string, unknown> }),
    logger: { warn() {}, error() {} },
  };
  return { pushed, context };
}

function source(
  ready: () => Promise<unknown>,
): DatabaseSource & { start: ReturnType<typeof vi.fn> } {
  return {
    name: "app",
    ready,
    start: vi.fn(async () => ({ supported: true as const })),
    stop: vi.fn(),
  };
}

describe("database track", () => {
  it("starts a source only once its database is open", async () => {
    const open = deferred();
    const app = source(() => open.promise);
    const { context } = harness();
    const track = createDatabaseTrack([app], () => "all");

    expect(track.health()).toEqual([{ name: "app", state: "off", detail: null }]);
    const started = track.start(context);
    await Promise.resolve();
    expect(app.start).not.toHaveBeenCalled();
    expect(track.health()[0]!.state).toBe("waiting");

    open.resolve();
    await started;
    expect(app.start).toHaveBeenCalledTimes(1);
    expect(track.health()[0]!.state).toBe("changes");
  });

  it("records a database that never opened instead of failing the recorder", async () => {
    const app = source(() => Promise.reject(new Error("opening the database timed out")));
    const { pushed, context } = harness();
    const track = createDatabaseTrack([app], () => "all");

    await track.start(context);

    expect(app.start).not.toHaveBeenCalled();
    expect(track.health()).toEqual([
      { name: "app", state: "unavailable", detail: "opening the database timed out" },
    ]);
    expect(pushed).toEqual([
      {
        kind: "marker",
        data: { kind: "database-unavailable", db: "app", reason: "opening the database timed out" },
      },
    ]);
  });

  it("does not start a source whose track stopped while it waited", async () => {
    const open = deferred();
    const app = source(() => open.promise);
    const { context } = harness();
    const track = createDatabaseTrack([app], () => "all");

    const started = track.start(context);
    track.stop();
    open.resolve();
    await started;

    expect(app.start).not.toHaveBeenCalled();
  });
});
