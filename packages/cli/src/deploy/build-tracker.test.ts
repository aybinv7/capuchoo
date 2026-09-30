import { describe, expect, it, vi } from "vite-plus/test";
import { Reporter } from "../utils/reporter.js";
import { BuildTracker, toBuildStep, type BuildApi } from "./build-tracker.js";
import { detectCiContext } from "./ci-context.js";

const START = {
  kind: "ota" as const,
  channel: "prod",
  version: "1.0.0",
  source: "cli" as const,
  commit: null,
  ref: null,
  pipeline_url: null,
};

function recordingApi(overrides: Partial<BuildApi> = {}) {
  const calls: string[] = [];
  const api: BuildApi = {
    createBuild: vi.fn(async () => {
      calls.push("create");
      return { id: "build-1" };
    }),
    buildEvent: vi.fn(async (_id, input) => {
      calls.push(`${input.step}:${input.status}`);
    }),
    finishBuild: vi.fn(async (_id, input) => {
      calls.push(`finish:${input.status}`);
    }),
    ...overrides,
  };
  return { api, calls };
}

describe("BuildTracker", () => {
  it("sends events in order after the build exists, then finishes", async () => {
    const { api, calls } = recordingApi();
    const tracker = BuildTracker.start(api, "app", START);

    tracker.step("resolve", "running", "Resolving");
    tracker.step("resolve", "succeeded", "");
    tracker.step("compile", "running", "Compiling");
    await tracker.finish({ status: "succeeded", bundle_id: "b1" });

    expect(calls).toEqual([
      "create",
      "resolve:running",
      "resolve:succeeded",
      "bundle:running",
      "finish:succeeded",
    ]);
    expect(await tracker.buildId()).toBe("build-1");
  });

  it("returns immediately from step, even while the server is slow", () => {
    const { api } = recordingApi({ createBuild: () => new Promise(() => {}) });
    const tracker = BuildTracker.start(api, "app", START);
    const started = performance.now();
    for (let index = 0; index < 100; index += 1) tracker.step("web", "running", "x");
    expect(performance.now() - started).toBeLessThan(50);
  });

  it("never throws into the deploy, and stops calling a failing server", async () => {
    const buildEvent = vi.fn(async () => {
      throw new Error("502");
    });
    const { api } = recordingApi({ buildEvent });
    const tracker = BuildTracker.start(api, "app", START);

    tracker.step("resolve", "running", "");
    tracker.step("web", "running", "");
    await expect(tracker.finish({ status: "failed", error: "boom" })).resolves.toBeUndefined();

    expect(buildEvent).toHaveBeenCalledTimes(1);
    expect(api.finishBuild).not.toHaveBeenCalled();
  });

  it("reports nothing when the build could not be created", async () => {
    const { api } = recordingApi({
      createBuild: async () => {
        throw new Error("404");
      },
    });
    const tracker = BuildTracker.start(api, "app", START);
    tracker.step("resolve", "running", "");
    await tracker.finish({ status: "succeeded" });

    expect(api.buildEvent).not.toHaveBeenCalled();
    expect(await tracker.buildId()).toBeUndefined();
  });

  it("gives up waiting at the flush timeout", async () => {
    const { api } = recordingApi({ finishBuild: () => new Promise(() => {}) });
    const tracker = BuildTracker.start(api, "app", START, { flushTimeoutMs: 20 });
    const started = performance.now();
    await tracker.finish({ status: "succeeded" });
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("does not wait long for a build id that has not arrived", async () => {
    const { api } = recordingApi({ createBuild: () => new Promise(() => {}) });
    const tracker = BuildTracker.start(api, "app", START);
    expect(await tracker.buildId(10)).toBeUndefined();
  });

  it("disabled trackers are silent", async () => {
    const tracker = BuildTracker.disabled();
    tracker.step("web", "running", "");
    await tracker.finish({ status: "succeeded" });
    expect(await tracker.buildId(0)).toBeUndefined();
  });

  it("maps pipeline steps onto the server's step names", () => {
    expect(
      [
        "resolve",
        "assets",
        "web",
        "native-config",
        "sync",
        "bundle",
        "compile",
        "sign",
        "upload",
      ].map(toBuildStep),
    ).toEqual(["resolve", "assets", "web", "native", "sync", "bundle", "bundle", "sign", "upload"]);
    expect(toBuildStep("something-else")).toBeNull();
  });
});

describe("Reporter step events", () => {
  it("emits running, then how each step ended", () => {
    const events: string[] = [];
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const reporter = new Reporter({
      quiet: true,
      onStep: (id, status, message) =>
        events.push(`${id}:${status}${message ? `:${message}` : ""}`),
    });

    reporter.plan([
      { id: "resolve", label: "Resolving" },
      { id: "assets", label: "Assets" },
      { id: "web", label: "Web" },
      { id: "upload", label: "Upload" },
    ]);
    reporter.begin("resolve");
    reporter.begin("assets");
    reporter.skip("no artwork");
    reporter.begin("web");
    reporter.begin("upload");
    reporter.fail("Deploy failed", "413 too large");
    stderr.mockRestore();

    expect(events).toEqual([
      "resolve:running:Resolving",
      "resolve:succeeded",
      "assets:running:Assets",
      "assets:skipped:no artwork",
      "web:running:Web",
      "web:succeeded",
      "upload:running:Upload",
      "upload:failed:413 too large",
    ]);
  });
});

describe("detectCiContext", () => {
  it("reads GitLab CI", () => {
    expect(
      detectCiContext({
        GITLAB_CI: "true",
        CI_COMMIT_SHA: "abc",
        CI_COMMIT_REF_NAME: "main",
        CI_PIPELINE_URL: "https://gitlab.example.com/p/-/pipelines/1",
        CI_JOB_URL: "https://gitlab.example.com/p/-/jobs/2",
      }),
    ).toEqual({
      source: "gitlab",
      commit: "abc",
      ref: "main",
      pipeline_url: "https://gitlab.example.com/p/-/pipelines/1",
      job_url: "https://gitlab.example.com/p/-/jobs/2",
    });
  });

  it("prefers the tag on a GitLab tag pipeline", () => {
    expect(
      detectCiContext({ GITLAB_CI: "true", CI_COMMIT_TAG: "v2.4.0", CI_COMMIT_REF_NAME: "v2.4.0x" })
        .ref,
    ).toBe("v2.4.0");
  });

  it("reads GitHub Actions", () => {
    expect(
      detectCiContext({
        GITHUB_ACTIONS: "true",
        GITHUB_SHA: "def",
        GITHUB_REF_NAME: "main",
        GITHUB_REPOSITORY: "acme/app",
        GITHUB_RUN_ID: "42",
      }),
    ).toMatchObject({
      source: "github",
      commit: "def",
      pipeline_url: "https://github.com/acme/app/actions/runs/42",
    });
  });

  it("is a plain CLI run elsewhere", () => {
    expect(detectCiContext({})).toEqual({
      source: "cli",
      commit: null,
      ref: null,
      pipeline_url: null,
      job_url: null,
    });
  });
});
