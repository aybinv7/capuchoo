import type { RecorderHealth } from "@capuchoo/core";
import { describe, expect, it } from "vite-plus/test";
import { healthChecks, overallTone } from "./health";
import { SETUP_ENGINES, pluginSnippet } from "./setup-snippets";

const healthy: RecorderHealth = {
  recorder: "0.1.0",
  mode: "buffer",
  threaded: true,
  storage: "opfs",
  databases: [{ name: "app", state: "changesets", detail: null }],
  queued: 0,
  uploadedSegments: 4,
  droppedSegments: 0,
  lastError: null,
};

describe("healthChecks", () => {
  it("passes a recorder that runs in a worker, on OPFS, with changesets", () => {
    const checks = healthChecks(healthy);
    expect(checks.map((check) => check.tone)).toEqual(["success", "success", "success"]);
    expect(overallTone(checks)).toBe("success");
  });

  it("says what to change for each problem, worst first in the summary", () => {
    const checks = healthChecks({
      ...healthy,
      threaded: false,
      storage: "memory",
      databases: [{ name: "app", state: "unavailable", detail: "timed out after 10000ms" }],
      droppedSegments: 2,
    });
    expect(checks.find((check) => check.id === "worker")?.fix).toContain("RecorderWorker");
    expect(checks.find((check) => check.id === "db:app")).toMatchObject({
      tone: "danger",
      fix: expect.stringContaining("timed out after 10000ms"),
    });
    expect(checks.find((check) => check.id === "dropped")?.value).toBe("2 segments");
    expect(overallTone(checks)).toBe("danger");
  });
});

describe("pluginSnippet", () => {
  it("wires the database each engine needs, and none without one", () => {
    expect(pluginSnippet("cavulsqa").code).toContain("fallback: sqlChangesSource");
    expect(pluginSnippet("sqlite").code).toContain('sqlChangesSource({ name: "app", execute');
    expect(pluginSnippet("none").code).not.toContain("databases");
    for (const engine of SETUP_ENGINES) {
      expect(pluginSnippet(engine.id).code).toContain("worker: () => new RecorderWorker()");
    }
  });
});
