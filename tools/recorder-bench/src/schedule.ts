import type { ArmName } from "./arms.ts";

export const WARMUP_SCENARIO = "cold-start";

export interface PlannedRun {
  rep: number;
  warmup: boolean;
  scenario: string;
  arm: ArmName;
}

/** mulberry32: small, fast and seedable, so a schedule can be reproduced from its seed. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(next() * (index + 1));
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  return copy;
}

/**
 * Arms interleaved inside every block of one scenario and one repetition, in a shuffled order per
 * block. Drift over the session (heat, battery, the server's load) then falls on every arm alike
 * instead of on whichever ran last. The warm-up is one cold start per arm, before everything else:
 * it absorbs what only the first launches after an install pay (compilation, the WebView's caches).
 */
export function planRuns(options: {
  arms: readonly ArmName[];
  scenarios: readonly string[];
  reps: number;
  warmup: boolean;
  seed: number;
}): PlannedRun[] {
  const next = random(options.seed);
  const runs: PlannedRun[] = [];
  if (options.warmup) {
    for (const arm of shuffled(options.arms, next)) {
      runs.push({ rep: 0, warmup: true, scenario: WARMUP_SCENARIO, arm });
    }
  }
  for (let rep = 1; rep <= options.reps; rep += 1) {
    for (const scenario of options.scenarios) {
      for (const arm of shuffled(options.arms, next)) {
        runs.push({ rep, warmup: false, scenario, arm });
      }
    }
  }
  return runs;
}
