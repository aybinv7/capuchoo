import { describe, expect, it } from "vite-plus/test";
import { build, buildDetail, buildJob } from "@/shared/testing/fixtures";
import { reconcileDetail } from "./reconcile";

describe("reconcileDetail", () => {
  it("keeps unchanged jobs and children by identity", () => {
    const job = buildJob({ id: "a", status: "running" });
    const child = { ...build({ id: "c", parent_id: "build-1" }), events: [] };
    const current = buildDetail({ jobs: [job], children: [child] });
    const next = reconcileDetail(
      current,
      buildDetail({ jobs: [{ ...job }], children: [{ ...child, events: [] }], status: "running" }),
    );
    expect(next.jobs[0]).toBe(job);
    expect(next.children[0]).toBe(child);
  });

  it("takes changed jobs and refuses a regression", () => {
    const current = buildDetail({
      jobs: [buildJob({ id: "a", status: "running" }), buildJob({ id: "b", status: "succeeded" })],
    });
    const next = reconcileDetail(
      current,
      buildDetail({
        jobs: [
          buildJob({ id: "a", status: "succeeded", updated_at: "2026-09-01T00:05:00.000Z" }),
          buildJob({ id: "b", status: "running" }),
        ],
      }),
    );
    expect(next.jobs.map((job) => job.status)).toEqual(["succeeded", "succeeded"]);
    expect(next.jobs[1]).toBe(current.jobs[1]);
  });
});
