import type { CdpSession } from "../cdp/session.ts";
import type { Ui } from "./ui.ts";

export interface ScenarioContext {
  page: CdpSession;
  ui: Ui;
  /** Seconds the scenario should run for; loops stop at the first boundary after it. */
  seconds: number;
  log: (line: string) => void;
}

export interface Scenario {
  name: string;
  summary: string;
  /** Run length in each profile, in seconds. */
  seconds: { quick: number; standard: number; soak: number };
  /** How often memory is sampled while it runs. */
  sampleEveryMs: number;
  run(context: ScenarioContext): Promise<void>;
}

export type Profile = keyof Scenario["seconds"];

export interface StepContext {
  page: CdpSession;
  ui: Ui;
}

/** One app under test: how to bring it to the measured state, and what to do in it. */
export interface AppUnderTest {
  name: string;
  packageName: string;
  /**
   * Runs in the unmeasured launch after the WebView was cleared: build the data every run starts
   * from. Identical for every arm.
   */
  prepare(context: StepContext): Promise<void>;
  /** Runs in the measured launch once the app settled, before any reading: clear what launch shows. */
  beforeMeasuring(context: StepContext): Promise<void>;
  scenarios: Scenario[];
}

/** Repeats `step` until `seconds` have passed, always finishing the step in progress. */
export async function loopFor(seconds: number, step: (round: number) => Promise<void>) {
  const deadline = Date.now() + seconds * 1000;
  for (let round = 0; Date.now() < deadline; round += 1) await step(round);
}
