import { describe, expect, it } from "vite-plus/test";
import {
  matchPlanJob,
  mergeBuildStatus,
  mergeJobStatus,
  parsePipelinePlan,
  planColumns,
  planEdges,
  type PipelinePlan,
  type PipelinePlanJob,
} from "./pipeline.js";

const job = (
  key: string,
  needs: string[] = [],
  extra: Partial<PipelinePlanJob> = {},
): PipelinePlanJob => ({
  key,
  name: key,
  needs,
  stage: null,
  gated: false,
  condition: null,
  ...extra,
});

const github: PipelinePlan = {
  provider: "github",
  source: ".github/workflows/capuchoo.yml",
  stages: [],
  jobs: [
    job("plan"),
    job("check", ["plan"]),
    job("publish-ota", ["plan", "check"]),
    job("publish-native", ["plan", "check"]),
    job("deliver", ["plan"], { gated: true }),
  ],
};

describe("mergeJobStatus", () => {
  it("never moves a job backwards", () => {
    expect(mergeJobStatus("running", "queued")).toBe("running");
    expect(mergeJobStatus("succeeded", "running")).toBe("succeeded");
    expect(mergeJobStatus("waiting", "queued")).toBe("waiting");
  });

  it("moves forwards and lets a newer terminal report win", () => {
    expect(mergeJobStatus("queued", "running")).toBe("running");
    expect(mergeJobStatus(null, "queued")).toBe("queued");
    expect(mergeJobStatus("failed", "succeeded")).toBe("succeeded");
  });
});

describe("mergeBuildStatus", () => {
  it("keeps a finished run finished within one attempt", () => {
    expect(mergeBuildStatus("succeeded", "running", { current: 1, incoming: 1 })).toBe("succeeded");
    expect(mergeBuildStatus("running", "queued")).toBe("running");
  });

  it("restarts on a re-run and ignores a stale attempt", () => {
    expect(mergeBuildStatus("failed", "queued", { current: 1, incoming: 2 })).toBe("queued");
    expect(mergeBuildStatus("running", "failed", { current: 2, incoming: 1 })).toBe("running");
  });
});

describe("planColumns", () => {
  it("places a job one column after the deepest job it needs", () => {
    const columns = planColumns(github);
    expect(Object.fromEntries(columns)).toEqual({
      plan: 0,
      check: 1,
      "publish-ota": 2,
      "publish-native": 2,
      deliver: 1,
    });
  });

  it("orders GitLab jobs without needs by stage", () => {
    const plan: PipelinePlan = {
      provider: "gitlab",
      source: null,
      stages: ["check", "publish", "deliver"],
      jobs: [
        job("check", [], { stage: "check" }),
        job("publish:ota", [], { stage: "publish" }),
        job("deliver:acme", [], { stage: "deliver" }),
      ],
    };
    expect(Object.fromEntries(planColumns(plan))).toEqual({
      check: 0,
      "publish:ota": 1,
      "deliver:acme": 2,
    });
    expect(planEdges(plan)).toEqual([
      { from: "check", to: "publish:ota" },
      { from: "publish:ota", to: "deliver:acme" },
    ]);
  });

  it("survives a cycle and an unknown dependency", () => {
    const plan: PipelinePlan = {
      ...github,
      jobs: [job("a", ["b"]), job("b", ["a"]), job("c", ["missing"])],
    };
    const columns = planColumns(plan);
    expect(columns.get("c")).toBe(0);
    expect(columns.size).toBe(3);
  });
});

describe("matchPlanJob", () => {
  it("matches by key, exact name, matrix suffix and templated name", () => {
    const plan: PipelinePlan = {
      ...github,
      jobs: [job("build", [], { name: "Build ${{ matrix.flavour }}" }), job("publish-ota")],
    };
    expect(matchPlanJob(plan, { name: "x", key: "publish-ota" })).toBe("publish-ota");
    expect(matchPlanJob(plan, { name: "publish-ota" })).toBe("publish-ota");
    expect(matchPlanJob(plan, { name: "build (dev)" })).toBe("build");
    expect(matchPlanJob(plan, { name: "Build (staging)" })).toBe("build");
    expect(matchPlanJob(plan, { name: "unrelated" })).toBeNull();
    expect(matchPlanJob(null, { name: "publish-ota" })).toBeNull();
  });
});

describe("parsePipelinePlan", () => {
  it("round-trips a plan and rejects what is not one", () => {
    expect(parsePipelinePlan(JSON.parse(JSON.stringify(github)))).toEqual(github);
    expect(parsePipelinePlan({ provider: "jenkins", jobs: [] })).toBeNull();
    expect(parsePipelinePlan("nope")).toBeNull();
  });

  it("drops malformed jobs instead of failing", () => {
    const plan = parsePipelinePlan({
      provider: "github",
      jobs: [{ key: "" }, { key: "ok", needs: [1, "x"] }],
    });
    expect(plan?.jobs).toEqual([job("ok", ["x"])]);
  });
});
