import type { PipelineStep } from "@capuchoo/core";

export type LogLineKind = "plain" | "command" | "group" | "error" | "warning" | "notice" | "debug";

export interface LogLine {
  time: string | null;
  text: string;
  kind: LogLineKind;
}

export interface LogStep {
  number: number | null;
  name: string;
  lines: LogLine[];
}

export const LOG_LIMITS = { lines: 20_000, lineChars: 4_000 } as const;

const BOM = /^﻿/;
const GITHUB_TIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z) ?(.*)$/;
const MARKER = /^##\[(group|endgroup|error|warning|notice|debug)\](.*)$/;
const STEP_START = /^(##\[group\]Run |Post job cleanup\.|Cleaning up orphan processes)/;
const GITLAB_SECTION_START = /section_start:\d+:[^\r\n[]+(?:\[[^\]]*\])?\r?(?:\u001b\[0K)?(.*)$/;
const GITLAB_SECTION_END = /section_end:\d+:[^\r\n]+/;
const ERASE_LINE = /\u001b\[0K/g;
const OVERDUE_MS = 1_000;

function classify(text: string): { text: string; kind: LogLineKind } | null {
  const marker = MARKER.exec(text);
  if (marker) {
    const kind = marker[1] as LogLineKind | "endgroup";
    if (kind === "endgroup") return null;
    return { text: marker[2] ?? "", kind };
  }
  if (text.startsWith("[command]")) return { text: text.slice(9), kind: "command" };
  return { text, kind: "plain" };
}

const clip = (text: string) =>
  text.length > LOG_LIMITS.lineChars ? `${text.slice(0, LOG_LIMITS.lineChars)}…` : text;

interface Window {
  step: PipelineStep;
  from: number;
  to: number;
}

function windows(steps: PipelineStep[]): Window[] {
  return steps
    .map((step) => ({
      step,
      from: step.started_at ? Date.parse(step.started_at) : Number.NaN,
      to: step.completed_at ? Date.parse(step.completed_at) : Number.POSITIVE_INFINITY,
    }))
    .filter((window) => Number.isFinite(window.from))
    .sort((a, b) => a.from - b.from || a.step.number - b.step.number);
}

/**
 * Splits a GitHub Actions job log into its steps. GitHub reports step times to the second, too
 * coarse on their own for steps a second long, so a step begins at the marker GitHub writes when
 * it starts one (`##[group]Run …`, or the post-job cleanup lines) once that step's start time is
 * reached; times alone move a step on only when the current one is clearly over.
 */
export function parseGithubLog(
  content: string,
  steps: PipelineStep[],
): { steps: LogStep[]; truncated: boolean } {
  const spans = windows(steps);
  const byNumber = new Map<number | null, LogLine[]>();
  let index = 0;
  let count = 0;
  let truncated = false;
  for (const raw of content.replace(BOM, "").split(/\r?\n/)) {
    if (!raw) continue;
    if (count >= LOG_LIMITS.lines) {
      truncated = true;
      break;
    }
    const stamped = GITHUB_TIME.exec(raw);
    const time = stamped?.[1] ?? null;
    const body = stamped ? (stamped[2] ?? "") : raw;
    if (time && spans.length > 0) {
      const at = Date.parse(time);
      const marker = STEP_START.test(body);
      while (index + 1 < spans.length) {
        const current = spans[index]!;
        const next = spans[index + 1]!;
        if (at < next.from) break;
        if (!marker && at <= current.to + OVERDUE_MS) break;
        index += 1;
        if (marker) break;
      }
    }
    const line = classify(body);
    if (!line) continue;
    const number = spans[index]?.step.number ?? null;
    const bucket = byNumber.get(number) ?? [];
    bucket.push({ time, text: clip(line.text), kind: line.kind });
    byNumber.set(number, bucket);
    count += 1;
  }
  const result: LogStep[] = steps.map((step) => ({
    number: step.number,
    name: step.name,
    lines: byNumber.get(step.number) ?? [],
  }));
  const orphans = byNumber.get(null);
  if (orphans?.length) result.unshift({ number: null, name: "Job", lines: orphans });
  return { steps: result, truncated };
}

/** A GitLab job trace as one step, its collapsible sections turned into groups. */
export function parseGitlabTrace(content: string): { steps: LogStep[]; truncated: boolean } {
  const lines: LogLine[] = [];
  let truncated = false;
  for (const raw of content.split(/\r?\n/)) {
    if (lines.length >= LOG_LIMITS.lines) {
      truncated = true;
      break;
    }
    const start = GITLAB_SECTION_START.exec(raw);
    if (start) {
      lines.push({ time: null, text: clip(start[1] ?? ""), kind: "group" });
      continue;
    }
    const text = raw.replace(GITLAB_SECTION_END, "").replace(ERASE_LINE, "").replace(/\r/g, "");
    if (!text.trim()) continue;
    lines.push({ time: null, text: clip(text), kind: text.startsWith("$ ") ? "command" : "plain" });
  }
  return { steps: [{ number: null, name: "Job log", lines }], truncated };
}
