import type { StepTarget } from "@capuchoo/core";
import type { Lanes, NetworkLaneEntry } from "../../types/recordings.types";
import { targetName } from "../steps";

export type PlanStep =
  | { kind: "visit"; t: number; url: string }
  | { kind: "url"; t: number; url: string }
  | { kind: "tap"; t: number; target: StepTarget; offsetX?: number; offsetY?: number }
  | { kind: "type"; t: number; target: StepTarget; value: string; variable: string | null }
  | { kind: "check"; t: number; target: StepTarget; checked: boolean }
  | { kind: "select"; t: number; target: StepTarget; value: string; variable: string | null }
  | { kind: "key"; t: number; target: StepTarget; key: string };

/** A recorded response a test can answer with, so it runs against the same data. */
export interface NetworkStub {
  method: string;
  url: string;
  status: number;
  contentType: string | null;
  body: string;
}

export interface ExportPlan {
  title: string;
  steps: PlanStep[];
  viewport: { width: number; height: number; dpr: number } | null;
  stubs: NetworkStub[];
  /** Names of the values a masked field held, which the test reads from its environment. */
  variables: string[];
  /** `android`, `ios` or `web`, as the recorder reported it. */
  platform: string;
}

export interface PlanInput {
  lanes: Lanes;
  /** Wall-clock range, inclusive. */
  from: number;
  to: number;
  title: string;
  viewport: { width: number; height: number; dpr: number } | null;
  platform: string;
  stubs: boolean;
}

/** A route this soon after a step is where that step led, so it is asserted there. */
const ROUTE_AFTER_STEP_MS = 5000;

function variableName(target: StepTarget, taken: Set<string>): string {
  const base =
    targetName(target)
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase() || "MASKED_VALUE";
  const name = /^[A-Z_]/.test(base) ? base : `FIELD_${base}`;
  let candidate = name;
  for (let index = 2; taken.has(candidate); index++) candidate = `${name}_${index}`;
  taken.add(candidate);
  return candidate;
}

function stubsOf(network: readonly NetworkLaneEntry[], from: number, to: number): NetworkStub[] {
  const seen = new Set<string>();
  const stubs: NetworkStub[] = [];
  for (const entry of network) {
    if (entry.t < from || entry.t > to) continue;
    if (entry.status === null || entry.responseBody === null) continue;
    const key = `${entry.method} ${entry.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const type = Object.entries(entry.responseHeaders).find(
      ([name]) => name.toLowerCase() === "content-type",
    )?.[1];
    stubs.push({
      method: entry.method.toUpperCase(),
      url: entry.url,
      status: entry.status,
      contentType: type ?? null,
      body: entry.responseBody,
    });
  }
  return stubs;
}

/** Whether one of the user's own steps came shortly before `t`, so a route then was its result. */
function ledThere(steps: readonly PlanStep[], t: number): boolean {
  for (let index = steps.length - 1; index >= 0; index--) {
    const step = steps[index]!;
    if (step.kind === "visit" || step.kind === "url" || step.t > t) continue;
    return t - step.t <= ROUTE_AFTER_STEP_MS;
  }
  return false;
}

/**
 * The steps a test replays for one stretch of a session: where the app was when it starts, each
 * tap and value in order, and every route a step led to as a check. A masked value becomes a
 * variable the test reads, never the value.
 */
export function buildExportPlan(input: PlanInput): ExportPlan {
  const { lanes, from, to } = input;
  const steps: PlanStep[] = [];
  const variables = new Set<string>();

  const routes = lanes.markers.filter((marker) => marker.kind === "route");
  let opening = routes[0];
  for (const route of routes) if (route.t <= from) opening = route;
  const openingUrl = typeof opening?.data.url === "string" ? opening.data.url : null;
  if (openingUrl) steps.push({ kind: "visit", t: from, url: openingUrl });

  for (const entry of lanes.steps) {
    if (entry.t < from || entry.t > to) continue;
    const { step } = entry;
    switch (step.action) {
      case "tap":
        steps.push({
          kind: "tap",
          t: entry.t,
          target: step.target,
          ...(step.offsetX !== undefined && step.offsetY !== undefined
            ? { offsetX: step.offsetX, offsetY: step.offsetY }
            : {}),
        });
        break;
      case "type":
      case "select": {
        const variable = step.masked ? variableName(step.target, variables) : null;
        steps.push({
          kind: step.action,
          t: entry.t,
          target: step.target,
          value: step.value ?? "",
          variable,
        });
        break;
      }
      case "check":
        steps.push({
          kind: "check",
          t: entry.t,
          target: step.target,
          checked: step.checked ?? true,
        });
        break;
      case "key":
        steps.push({ kind: "key", t: entry.t, target: step.target, key: step.key ?? "Enter" });
        break;
    }
  }

  let lastUrl = openingUrl;
  for (const route of routes) {
    if (route.t <= from || route.t > to || typeof route.data.url !== "string") continue;
    if (route.data.url === lastUrl) continue;
    if (!ledThere(steps, route.t)) continue;
    lastUrl = route.data.url;
    steps.push({ kind: "url", t: route.t, url: route.data.url });
  }
  steps.sort((a, b) => a.t - b.t || (a.kind === "url" ? 1 : 0) - (b.kind === "url" ? 1 : 0));

  return {
    title: input.title,
    steps,
    viewport: input.viewport,
    stubs: input.stubs ? stubsOf(lanes.network, from, to) : [],
    variables: [...variables],
    platform: input.platform,
  };
}
