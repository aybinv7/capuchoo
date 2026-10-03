import { toCapubridge } from "./capubridge";
import { toChromeRecorder } from "./chrome-recorder";
import { toCypress } from "./cypress";
import type { ExportPlan } from "./plan";
import { toPlaywright } from "./playwright";
import type { ExportOptions, ExportResult } from "./types";

export const EXPORT_FORMATS = ["cypress", "playwright", "chrome-recorder", "capubridge"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface FormatInfo {
  label: string;
  /** What the format is for, in one line. */
  hint: string;
  /** The file name ending a download gets. */
  extension: string;
  /** Whether the export answers requests with the recorded responses. */
  stubs: boolean;
  /** Whether the format runs the app's web build, and so needs where it is served. */
  baseUrl: boolean;
  generate: (plan: ExportPlan, options: ExportOptions) => ExportResult;
}

export const FORMATS: Record<ExportFormat, FormatInfo> = {
  cypress: {
    label: "Cypress",
    hint: "A spec for the web build, with the recorded responses as fixtures",
    extension: ".cy.ts",
    stubs: true,
    baseUrl: true,
    generate: toCypress,
  },
  playwright: {
    label: "Playwright",
    hint: "A test for the web build in a phone-sized touch viewport",
    extension: ".spec.ts",
    stubs: true,
    baseUrl: true,
    generate: toPlaywright,
  },
  "chrome-recorder": {
    label: "Chrome Recorder",
    hint: "JSON for Chrome DevTools Recorder and @puppeteer/replay",
    extension: ".json",
    stubs: false,
    baseUrl: true,
    generate: toChromeRecorder,
  },
  capubridge: {
    label: "Capubridge",
    hint: "A flow that replays the session on a real phone",
    extension: ".flow.json",
    stubs: false,
    baseUrl: false,
    generate: toCapubridge,
  },
};

export const isExportFormat = (value: unknown): value is ExportFormat =>
  typeof value === "string" && (EXPORT_FORMATS as readonly string[]).includes(value);
