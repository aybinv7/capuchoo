import { describe, expect, it } from "vite-plus/test";
import { parseGithubLog, parseGitlabTrace } from "../src/services/job-log-parser";

const step = (number: number, name: string, started: string, completed: string) => ({
  number,
  name,
  status: "succeeded" as const,
  started_at: `2026-10-02T15:03:${started}Z`,
  completed_at: `2026-10-02T15:03:${completed}Z`,
});

const steps = [
  step(1, "Set up job", "30", "31"),
  step(2, "Run actions/checkout@v5", "31", "32"),
  step(3, "Install", "32", "38"),
  step(12, "Post Run actions/checkout@v5", "38", "39"),
  step(13, "Complete job", "39", "39"),
];

const log = [
  "﻿2026-10-02T15:03:30.21Z Current runner version: '2.337.0'",
  "2026-10-02T15:03:30.22Z ##[group]Runner Image",
  "2026-10-02T15:03:30.23Z Image: ubuntu-24.04",
  "2026-10-02T15:03:30.24Z ##[endgroup]",
  "2026-10-02T15:03:31.10Z Secret source: Actions",
  "2026-10-02T15:03:31.27Z ##[group]Run actions/checkout@v5",
  "2026-10-02T15:03:31.40Z [command]/usr/bin/git version",
  "2026-10-02T15:03:32.09Z ##[group]Run set -euo pipefail",
  "2026-10-02T15:03:35.00Z \u001b[32mDone\u001b[0m",
  "2026-10-02T15:03:37.00Z ##[error]Process completed with exit code 1.",
  "2026-10-02T15:03:38.50Z Post job cleanup.",
  "2026-10-02T15:03:39.20Z Cleaning up orphan processes",
].join("\n");

describe("parseGithubLog", () => {
  it("starts each step at GitHub's marker, not at the second-rounded step time", () => {
    const parsed = parseGithubLog(log, steps);
    const byNumber = Object.fromEntries(
      parsed.steps.map((entry) => [
        entry.number,
        entry.lines.filter((line) => line.kind !== "endgroup").map((line) => line.text),
      ]),
    );
    expect(byNumber[1]).toEqual([
      "Current runner version: '2.337.0'",
      "Runner Image",
      "Image: ubuntu-24.04",
      "Secret source: Actions",
    ]);
    expect(byNumber[2]).toEqual(["Run actions/checkout@v5", "/usr/bin/git version"]);
    expect(byNumber[3]).toEqual([
      "Run set -euo pipefail",
      "\u001b[32mDone\u001b[0m",
      "Process completed with exit code 1.",
    ]);
    expect(byNumber[12]).toEqual(["Post job cleanup."]);
    expect(byNumber[13]).toEqual(["Cleaning up orphan processes"]);
  });

  it("classifies GitHub's markers", () => {
    const kinds = parseGithubLog(log, steps).steps.flatMap((entry) =>
      entry.lines.map((line) => line.kind),
    );
    expect(kinds).toContain("group");
    expect(kinds).toContain("command");
    expect(kinds).toContain("error");
    expect(kinds).toContain("endgroup");
  });

  it("caps the number of lines and says so", () => {
    const long = Array.from(
      { length: 20_005 },
      (_, index) => `2026-10-02T15:03:33.00Z line ${index}`,
    ).join("\n");
    const parsed = parseGithubLog(long, steps);
    expect(parsed.truncated).toBe(true);
    expect(parsed.steps.reduce((sum, entry) => sum + entry.lines.length, 0)).toBe(20_000);
  });
});

describe("parseGitlabTrace", () => {
  it("turns sections into groups and keeps commands", () => {
    const trace = [
      "\u001b[0Ksection_start:1696:prepare_script[collapsed=true]\r\u001b[0KPreparing environment",
      "Running on runner-1",
      "\u001b[0Ksection_end:1696:prepare_script\r\u001b[0K",
      "$ capuchoo deploy ota --channel dev",
      "",
    ].join("\n");
    const [only] = parseGitlabTrace(trace).steps;
    expect(only?.lines).toEqual([
      { time: null, text: "Preparing environment", kind: "group" },
      { time: null, text: "Running on runner-1", kind: "plain" },
      { time: null, text: "$ capuchoo deploy ota --channel dev", kind: "command" },
    ]);
  });
});
