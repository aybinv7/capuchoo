import type { PipelineStep } from "@capuchoo/core";
import { describe, expect, it } from "vite-plus/test";
import { buildJob } from "@/shared/testing/fixtures";
import type { LogLine, LogStep } from "../types/job-logs.types";
import {
  WHOLE_LOG_KEY,
  jobStepViews,
  normalizeJobLogs,
  shouldFetchLogs,
  stepKey,
  unavailableMessage,
} from "./job-logs";

const line = (text: string, kind: LogLine["kind"] = "plain"): LogLine => ({
  time: null,
  text,
  kind,
});
const section = (number: number | null, name: string, ...texts: string[]): LogStep => ({
  number,
  name,
  lines: texts.map((text) => line(text)),
});
const step = (number: number, name: string, status: PipelineStep["status"] = "succeeded") => ({
  number,
  name,
  status,
  started_at: null,
  completed_at: null,
});

const texts = (lines: readonly LogLine[] | null) => lines?.map((entry) => entry.text) ?? null;

describe("jobStepViews", () => {
  const job = buildJob({
    status: "failed",
    steps: [step(1, "Set up job"), step(2, "Build web"), step(3, "Upload", "failed")],
  });

  it("leaves every step without lines until the log is loaded", () => {
    const views = jobStepViews(job, null);
    expect(views.map((view) => [view.key, view.lines])).toEqual([
      [stepKey(1), null],
      [stepKey(2), null],
      [stepKey(3), null],
    ]);
  });

  it("gives each step the lines of its number, and nothing when none match", () => {
    const views = jobStepViews(job, {
      steps: [section(3, "Upload", "boom"), section(1, "Set up job", "runner 2.3")],
    });
    expect(views.map((view) => texts(view.lines))).toEqual([["runner 2.3"], [], ["boom"]]);
  });

  it("falls back to the name for a section without a usable number, once", () => {
    const views = jobStepViews(job, {
      steps: [
        section(null, "build web", "vite build"),
        section(99, "Upload", "put"),
        section(null, "Build web", "second copy"),
      ],
    });
    expect(texts(views[1]!.lines)).toEqual(["vite build"]);
    expect(texts(views[2]!.lines)).toEqual(["put"]);
    expect(views.slice(3).map((view) => [view.name, view.status, texts(view.lines)])).toEqual([
      ["Build web", null, ["second copy"]],
    ]);
  });

  it("keeps a number's lines together when the provider split them", () => {
    const views = jobStepViews(job, {
      steps: [section(2, "Build web", "a"), section(2, "Build web (cont.)", "b")],
    });
    expect(texts(views[1]!.lines)).toEqual(["a", "b"]);
    expect(views).toHaveLength(3);
  });

  it("lists sections no step claims after the steps, and drops empty ones", () => {
    const views = jobStepViews(job, {
      steps: [section(null, "Post job cleanup", "done"), section(null, "Empty")],
    });
    expect(views.map((view) => view.key)).toEqual([
      stepKey(1),
      stepKey(2),
      stepKey(3),
      "section:0",
    ]);
  });

  it("shows a job without steps as one log, each section a group", () => {
    const gitlab = buildJob({ status: "failed", steps: [] });
    const [single] = jobStepViews(gitlab, {
      steps: [section(null, "prepare", "pulling"), section(null, "script", "$ vp build")],
    });
    expect(single).toMatchObject({ key: WHOLE_LOG_KEY, name: "Job log", status: "failed" });
    expect(single!.lines?.map((entry) => [entry.kind, entry.text])).toEqual([
      ["group", "prepare"],
      ["plain", "pulling"],
      ["group", "script"],
      ["plain", "$ vp build"],
    ]);
    const [one] = jobStepViews(gitlab, { steps: [section(null, "all", "x")] });
    expect(texts(one!.lines)).toEqual(["x"]);
  });
});

describe("normalizeJobLogs", () => {
  it("reads an available log, dropping malformed lines and stripping the command prefix", () => {
    const logs = normalizeJobLogs({
      available: true,
      source: "github",
      truncated: true,
      steps: [
        {
          number: 2,
          name: "Build",
          lines: [
            { time: "2026-09-01T10:00:00Z", text: "[command]/usr/bin/git fetch", kind: "plain" },
            { text: "[command]vp build", kind: "command" },
            { text: 42, kind: "plain" },
            { text: "odd", kind: "mystery" },
            "not a line",
          ],
        },
        { number: "3", lines: [] },
        null,
      ],
    });
    expect(logs).toEqual({
      available: true,
      source: "github",
      truncated: true,
      steps: [
        {
          number: 2,
          name: "Build",
          lines: [
            { time: "2026-09-01T10:00:00Z", text: "/usr/bin/git fetch", kind: "command" },
            { time: null, text: "vp build", kind: "command" },
            { time: null, text: "odd", kind: "plain" },
          ],
        },
        { number: null, name: "Section 2", lines: [] },
      ],
    });
  });

  it("reads an unavailable log and defaults an unknown reason", () => {
    expect(
      normalizeJobLogs({ available: false, reason: "expired", html_url: "https://x" }),
    ).toEqual({ available: false, reason: "expired", html_url: "https://x" });
    expect(normalizeJobLogs({ available: false, reason: "gone" })).toEqual({
      available: false,
      reason: "not_found",
      html_url: null,
    });
  });

  it("refuses something that is not a log", () => {
    expect(() => normalizeJobLogs(null)).toThrow("not a job log");
    expect(() => normalizeJobLogs("<html>")).toThrow("not a job log");
    expect(() => normalizeJobLogs({ steps: [] })).toThrow("not a job log");
  });
});

describe("shouldFetchLogs", () => {
  it("asks only for a finished job, and only when something needs the lines", () => {
    expect(shouldFetchLogs({ status: "running" }, true)).toBe(false);
    expect(shouldFetchLogs({ status: "queued" }, true)).toBe(false);
    expect(shouldFetchLogs({ status: "failed" }, false)).toBe(false);
    expect(shouldFetchLogs(null, true)).toBe(false);
    expect(shouldFetchLogs({ status: "failed" }, true)).toBe(true);
    expect(shouldFetchLogs({ status: "succeeded" }, true)).toBe(true);
  });
});

describe("unavailableMessage", () => {
  it("names the provider and says why", () => {
    expect(unavailableMessage("running", "github")).toBe(
      "Logs appear when the job finishes — GitHub only publishes them then.",
    );
    expect(unavailableMessage("running", "gitlab")).toContain("GitLab shows them live");
    expect(unavailableMessage("expired", "github")).toContain("retention");
  });
});
