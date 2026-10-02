import { describe, expect, it } from "vite-plus/test";
import { buildJob } from "@/shared/testing/fixtures";
import type { BuildEvent } from "@/shared/types/build";
import { currentDeployStep, deploySteps } from "./deploy-steps";
import { durationSeconds, jobCaption } from "./job-status";

const step = (
  number: number,
  name: string,
  status: "succeeded" | "running" | "failed" | "pending",
) => ({
  number,
  name,
  status,
  started_at: null,
  completed_at: null,
});

describe("jobCaption", () => {
  const node = { gated: false, condition: null, job: null } as const;

  it("explains a job that has not started", () => {
    expect(jobCaption({ ...node, status: "pending" })).toBe("Not started");
    expect(jobCaption({ ...node, status: "pending", gated: true })).toBe("Needs approval to run");
    expect(jobCaption({ ...node, status: "waiting", gated: true })).toBe("Waiting for approval");
  });

  it("names the running step and the failing one", () => {
    const steps = [
      step(1, "Checkout", "succeeded"),
      step(2, "Test", "running"),
      step(3, "Deploy", "pending"),
    ];
    expect(jobCaption({ ...node, status: "running", job: buildJob({ steps }) })).toBe("2/3 · Test");
    const failed = [step(1, "Checkout", "succeeded"), step(2, "Test", "failed")];
    expect(jobCaption({ ...node, status: "failed", job: buildJob({ steps: failed }) })).toBe(
      "Failed at Test",
    );
  });

  it("says where a queued job waits", () => {
    expect(
      jobCaption({ ...node, status: "queued", job: buildJob({ runner: "ubuntu-latest" }) }),
    ).toBe("Queued on ubuntu-latest");
  });
});

describe("durationSeconds", () => {
  it("is null until both ends exist", () => {
    expect(durationSeconds("2026-09-01T00:00:00Z", null)).toBeNull();
    expect(durationSeconds("2026-09-01T00:00:00Z", "2026-09-01T00:01:05Z")).toBe(65);
  });
});

describe("deploySteps", () => {
  const event = (
    id: number,
    name: string,
    status: BuildEvent["status"],
    message: string | null = null,
  ): BuildEvent => ({
    id: String(id),
    build_id: "d",
    step: name,
    status,
    message,
    created_at: `2026-09-01T00:00:0${id}.000Z`,
  });

  it("keeps the latest status per step in the CLI's order", () => {
    const steps = deploySteps([
      event(1, "resolve", "running"),
      event(2, "resolve", "succeeded"),
      event(3, "upload", "running"),
      event(4, "web", "succeeded"),
      event(5, "custom", "succeeded"),
    ]);
    expect(steps.map((entry) => [entry.step, entry.status])).toEqual([
      ["resolve", "succeeded"],
      ["web", "succeeded"],
      ["upload", "running"],
      ["custom", "succeeded"],
    ]);
    expect(currentDeployStep(steps)?.step).toBe("upload");
  });

  it("lets an info event carry a message without changing the status", () => {
    const steps = deploySteps([event(1, "sign", "running"), event(2, "sign", "info", "key a1b2")]);
    expect(steps[0]).toMatchObject({ status: "running", message: "key a1b2" });
  });

  it("points at the failing step", () => {
    const steps = deploySteps([event(1, "bundle", "failed"), event(2, "upload", "skipped")]);
    expect(currentDeployStep(steps)?.step).toBe("bundle");
    expect(currentDeployStep([])).toBeNull();
  });
});
