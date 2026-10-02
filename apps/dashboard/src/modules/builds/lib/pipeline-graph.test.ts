import type { PipelinePlan, PipelinePlanJob } from "@capuchoo/core";
import { describe, expect, it } from "vite-plus/test";
import { build, buildJob } from "@/shared/testing/fixtures";
import {
  diffFlowNodes,
  edgeSignature,
  toFlowEdges,
  toFlowNodes,
  type FlowNode,
} from "./pipeline-flow";
import {
  buildPipelineModel,
  latestAttempts,
  pipelineProgress,
  type PipelineInput,
} from "./pipeline-graph";
import { PIPELINE_LAYOUT, layoutPipeline } from "./pipeline-layout";

const planned = (key: string, overrides: Partial<PipelinePlanJob> = {}): PipelinePlanJob => ({
  key,
  name: key,
  needs: [],
  stage: null,
  gated: false,
  condition: null,
  ...overrides,
});

const GITHUB_PLAN: PipelinePlan = {
  provider: "github",
  source: ".github/workflows/capuchoo.yml",
  stages: [],
  jobs: [
    planned("plan"),
    planned("build", { name: "build", needs: ["plan"] }),
    planned("check", { needs: ["plan"] }),
    planned("publish", { needs: ["build", "check"], gated: true }),
  ],
};

const input = (overrides: Partial<PipelineInput> = {}): PipelineInput => ({
  plan: GITHUB_PLAN,
  jobs: [],
  children: [],
  finished: false,
  ...overrides,
});

const byId = (model: ReturnType<typeof buildPipelineModel>) =>
  new Map(model.nodes.map((node) => [node.id, node]));

describe("buildPipelineModel", () => {
  it("draws every planned job before anything has run", () => {
    const model = buildPipelineModel(input());
    expect(model.nodes.map((node) => [node.id, node.column, node.status])).toEqual([
      ["plan:plan", 0, "pending"],
      ["plan:build", 1, "pending"],
      ["plan:check", 1, "pending"],
      ["plan:publish", 2, "pending"],
    ]);
    expect(model.edges.map((edge) => edge.id)).toEqual([
      "plan:plan->plan:build",
      "plan:plan->plan:check",
      "plan:build->plan:publish",
      "plan:check->plan:publish",
    ]);
    expect(byId(model).get("plan:publish")?.gated).toBe(true);
  });

  it("draws planned jobs that never started as skipped once the run is over", () => {
    const model = buildPipelineModel(input({ finished: true }));
    expect(model.nodes.every((node) => node.status === "skipped")).toBe(true);
  });

  it("merges reported jobs by key, then by name, and fans a matrix out in one column", () => {
    const model = buildPipelineModel(
      input({
        jobs: [
          buildJob({ id: "1", plan_key: "plan", name: "plan", status: "succeeded" }),
          buildJob({ id: "2", name: "build (ios)", status: "running" }),
          buildJob({ id: "3", name: "build (android)", status: "succeeded" }),
          buildJob({ id: "4", name: "check", status: "queued" }),
        ],
      }),
    );
    const nodes = byId(model);
    expect(nodes.get("plan:plan")?.status).toBe("succeeded");
    expect(nodes.get("plan:build")?.name).toBe("build (android)");
    expect(nodes.get("plan:build#build (ios)")).toMatchObject({ column: 1, status: "running" });
    expect(nodes.get("plan:check")?.status).toBe("queued");
    expect(model.edges.filter((edge) => edge.target === "plan:publish")).toHaveLength(3);
    expect(model.edges.find((edge) => edge.target === "plan:build#build (ios)")?.state).toBe(
      "active",
    );
  });

  it("appends jobs the plan does not know in a column of their own", () => {
    const model = buildPipelineModel(
      input({ jobs: [buildJob({ id: "9", external_id: "77", name: "lint", status: "failed" })] }),
    );
    expect(byId(model).get("job:77")).toMatchObject({ column: 3, status: "failed", key: null });
  });

  it("groups a GitLab run without a plan by stage", () => {
    const model = buildPipelineModel(
      input({
        plan: null,
        jobs: [
          buildJob({ id: "1", name: "install", stage: "prepare", status: "succeeded" }),
          buildJob({ id: "2", name: "web", stage: "build", status: "running" }),
          buildJob({ id: "3", name: "android", stage: "build", status: "queued" }),
          buildJob({ id: "4", name: "deploy", stage: "publish", status: "pending" }),
        ],
      }),
    );
    expect(model.nodes.map((node) => [node.name, node.column])).toEqual([
      ["install", 0],
      ["web", 1],
      ["android", 1],
      ["deploy", 2],
    ]);
    expect(model.columnStages).toEqual(["prepare", "build", "publish"]);
    expect(model.edges).toHaveLength(4);
  });

  it("keeps only the latest attempt of a re-run job", () => {
    const jobs = [
      buildJob({ id: "a", name: "check", attempt: 1, status: "failed" }),
      buildJob({ id: "b", name: "check", attempt: 2, status: "running" }),
    ];
    expect(latestAttempts(jobs).map((job) => job.id)).toEqual(["b"]);
    expect(byId(buildPipelineModel(input({ jobs }))).get("plan:check")?.status).toBe("running");
  });

  it("attaches each deploy to the job it ran in, and keeps the rest aside", () => {
    const deploy = { ...build({ id: "d1", parent_id: "run", job_key: "publish" }), events: [] };
    const stray = { ...build({ id: "d2", parent_id: "run", job_key: "elsewhere" }), events: [] };
    const model = buildPipelineModel(input({ children: [deploy, stray] }));
    expect(byId(model).get("plan:publish")?.deploy?.id).toBe("d1");
    expect(model.unattached.map((child) => child.id)).toEqual(["d2"]);
  });

  it("returns unchanged nodes as the same objects", () => {
    const jobs = [
      buildJob({ id: "1", plan_key: "plan", name: "plan", status: "succeeded" }),
      buildJob({ id: "4", name: "check", status: "queued" }),
    ];
    const first = buildPipelineModel(input({ jobs }));
    const next = buildPipelineModel(
      input({ jobs: [jobs[0]!, { ...jobs[1]!, status: "running" }] }),
      byId(first),
    );
    expect(byId(next).get("plan:plan")).toBe(byId(first).get("plan:plan"));
    expect(byId(next).get("plan:check")).not.toBe(byId(first).get("plan:check"));
  });

  it("counts progress over the drawn jobs", () => {
    const model = buildPipelineModel(
      input({
        jobs: [
          buildJob({ id: "1", plan_key: "plan", name: "plan", status: "succeeded" }),
          buildJob({ id: "4", name: "check", status: "failed" }),
          buildJob({ id: "2", name: "build (ios)", status: "running" }),
        ],
      }),
    );
    expect(pipelineProgress(model)).toEqual({ total: 4, finished: 2, failed: 1, running: 1 });
  });
});

describe("layoutPipeline", () => {
  it("places columns left to right and centres a short column on the tallest", () => {
    const model = buildPipelineModel(input());
    const layout = layoutPipeline(model);
    const { nodeWidth, columnGap, nodeHeight, rowGap } = PIPELINE_LAYOUT;
    expect(layout.positions.get("plan:plan")).toEqual({ x: 0, y: (nodeHeight + rowGap) / 2 });
    expect(layout.positions.get("plan:build")).toEqual({ x: nodeWidth + columnGap, y: 0 });
    expect(layout.positions.get("plan:check")?.y).toBe(nodeHeight + rowGap);
    expect(layout.width).toBe(3 * nodeWidth + 2 * columnGap);
    expect(layout.height).toBe(2 * nodeHeight + rowGap);
  });

  it("makes room for stage labels and a deploy's step track", () => {
    const model = buildPipelineModel(
      input({
        plan: null,
        jobs: [buildJob({ id: "1", name: "deploy", stage: "publish" })],
        children: [{ ...build({ id: "d", parent_id: "run", job_key: "deploy" }), events: [] }],
      }),
    );
    const layout = layoutPipeline(model);
    expect(layout.stageLabels).toEqual([{ column: 0, label: "publish", x: 0, y: 0 }]);
    expect(layout.positions.get("plan:deploy")?.y).toBe(PIPELINE_LAYOUT.stageHeight);
    expect(layout.height).toBe(
      PIPELINE_LAYOUT.stageHeight + PIPELINE_LAYOUT.nodeHeight + PIPELINE_LAYOUT.deployHeight,
    );
  });
});

describe("pipeline flow adapter", () => {
  const index = (nodes: FlowNode[]) => new Map(nodes.map((node) => [node.id, node]));

  it("patches only the node whose job changed", () => {
    const jobs = [buildJob({ id: "4", name: "check", status: "queued" })];
    const first = buildPipelineModel(input({ jobs }));
    const before = toFlowNodes(first, layoutPipeline(first));
    const second = buildPipelineModel(
      input({ jobs: [{ ...jobs[0]!, status: "running" }] }),
      new Map(first.nodes.map((node) => [node.id, node])),
    );
    const changes = diffFlowNodes(index(before), toFlowNodes(second, layoutPipeline(second)));
    expect(changes.add).toEqual([]);
    expect(changes.remove).toEqual([]);
    expect(changes.update.map((node) => node.id)).toEqual(["plan:check"]);
  });

  it("adds and removes nodes as the graph grows and shrinks", () => {
    const empty = buildPipelineModel(input());
    const grown = buildPipelineModel(
      input({ jobs: [buildJob({ id: "9", external_id: "77", name: "lint" })] }),
    );
    const added = diffFlowNodes(
      index(toFlowNodes(empty, layoutPipeline(empty))),
      toFlowNodes(grown, layoutPipeline(grown)),
    );
    expect(added.add.map((node) => node.id)).toEqual(["job:77"]);
    const removed = diffFlowNodes(
      index(toFlowNodes(grown, layoutPipeline(grown))),
      toFlowNodes(empty, layoutPipeline(empty)),
    );
    expect(removed.remove).toEqual(["job:77"]);
  });

  it("animates edges into running jobs and changes its signature with state", () => {
    const running = buildPipelineModel(
      input({ jobs: [buildJob({ id: "4", name: "check", status: "running" })] }),
    );
    const edges = toFlowEdges(running);
    expect(edges.find((edge) => edge.target === "plan:check")).toMatchObject({
      animated: true,
      class: "pipeline-edge pipeline-edge-active",
    });
    const done = buildPipelineModel(
      input({ jobs: [buildJob({ id: "4", name: "check", status: "succeeded" })] }),
    );
    expect(edgeSignature(toFlowEdges(done))).not.toBe(edgeSignature(edges));
  });
});
