import type { JobStatus } from "@capuchoo/core";
import { describe, expect, it } from "vite-plus/test";
import { buildJob } from "@/shared/testing/fixtures";
import {
  defaultJobNode,
  isOffscreen,
  jobGroups,
  resolveSelection,
  selectionKey,
} from "./job-selection";
import type { PipelineNodeModel } from "./pipeline-graph";

function node(id: string, status: JobStatus, column = 0, reported = true): PipelineNodeModel {
  return {
    id,
    key: id,
    name: id,
    status,
    column,
    row: 0,
    stage: null,
    gated: false,
    condition: null,
    job: reported ? buildJob({ id: `job-${id}`, name: id, status }) : null,
    deploy: null,
  };
}

describe("defaultJobNode", () => {
  it("opens the first failure before anything else", () => {
    const nodes = [node("a", "running"), node("b", "failed"), node("c", "failed")];
    expect(defaultJobNode(nodes)?.id).toBe("b");
  });

  it("opens the running job when nothing failed, then a waiting one", () => {
    expect(defaultJobNode([node("a", "succeeded"), node("b", "running")])?.id).toBe("b");
    expect(defaultJobNode([node("a", "succeeded"), node("b", "waiting")])?.id).toBe("b");
  });

  it("opens the last job that reported once the run has passed", () => {
    const nodes = [node("a", "succeeded"), node("b", "succeeded"), node("c", "skipped", 1, false)];
    expect(defaultJobNode(nodes)?.id).toBe("b");
    expect(defaultJobNode([node("p", "pending", 0, false)])?.id).toBe("p");
    expect(defaultJobNode([])).toBeNull();
  });
});

describe("resolveSelection", () => {
  const nodes = [node("a", "succeeded"), node("b", "failed"), node("c", "pending", 1, false)];

  it("follows ?job= by job row id, or by node id for a job not started", () => {
    expect(resolveSelection(nodes, "job-a")?.id).toBe("a");
    expect(resolveSelection(nodes, "c")?.id).toBe("c");
  });

  it("falls back to the default for a missing or stale value", () => {
    expect(resolveSelection(nodes, null)?.id).toBe("b");
    expect(resolveSelection(nodes, "job-from-an-older-attempt")?.id).toBe("b");
  });

  it("writes the job row id when there is one", () => {
    expect(selectionKey(nodes[0]!)).toBe("job-a");
    expect(selectionKey(nodes[2]!)).toBe("c");
  });
});

describe("jobGroups", () => {
  it("groups by column, in order, with the column's stage", () => {
    const groups = jobGroups({
      nodes: [node("b", "running", 1), node("a", "succeeded", 0), node("c", "queued", 1)],
      columns: 3,
      columnStages: ["prepare", null, null],
    });
    expect(
      groups.map((group) => [group.column, group.label, group.nodes.map((n) => n.id)]),
    ).toEqual([
      [0, "prepare", ["a"]],
      [1, null, ["b", "c"]],
    ]);
  });
});

describe("isOffscreen", () => {
  it("is true only when too little of the panel shows", () => {
    expect(isOffscreen({ top: 900, bottom: 1600 }, 800)).toBe(true);
    expect(isOffscreen({ top: 700, bottom: 1400 }, 800)).toBe(true);
    expect(isOffscreen({ top: 400, bottom: 1100 }, 800)).toBe(false);
    expect(isOffscreen({ top: -900, bottom: 60 }, 800)).toBe(true);
    expect(isOffscreen({ top: -200, bottom: 500 }, 800)).toBe(false);
  });
});
