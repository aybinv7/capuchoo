import { joinUrl, recorderSelectors } from "./locators";
import type { ExportPlan, PlanStep } from "./plan";
import type { ExportOptions, ExportResult } from "./types";

/** A step of Chrome DevTools Recorder's JSON, the format `@puppeteer/replay` reads. */
type RecorderStep = Record<string, unknown> & { type: string };

/** Where a click lands when the recording did not say: just inside the element's corner. */
const DEFAULT_OFFSET = 1;

function stepsOf(step: PlanStep, baseUrl: string): RecorderStep[] {
  switch (step.kind) {
    case "visit": {
      const url = joinUrl(baseUrl, step.url);
      return [{ type: "navigate", url, assertedEvents: [{ type: "navigation", url, title: "" }] }];
    }
    case "url":
      return [
        {
          type: "waitForExpression",
          expression: `location.href.includes(${JSON.stringify(step.url)})`,
        },
      ];
    case "tap":
      return [
        {
          type: "click",
          target: "main",
          selectors: recorderSelectors(step.target),
          offsetX: step.offsetX ?? DEFAULT_OFFSET,
          offsetY: step.offsetY ?? DEFAULT_OFFSET,
        },
      ];
    case "check":
      return [
        {
          type: "click",
          target: "main",
          selectors: recorderSelectors(step.target),
          offsetX: DEFAULT_OFFSET,
          offsetY: DEFAULT_OFFSET,
        },
      ];
    case "type":
    case "select":
      return [
        {
          type: "change",
          target: "main",
          selectors: recorderSelectors(step.target),
          value: step.variable ? "" : step.value,
        },
      ];
    case "key":
      return [
        { type: "keyDown", target: "main", key: step.key },
        { type: "keyUp", target: "main", key: step.key },
      ];
  }
}

export function toChromeRecorder(plan: ExportPlan, options: ExportOptions): ExportResult {
  const steps: RecorderStep[] = [];
  if (plan.viewport) {
    const mobile = plan.platform !== "web";
    steps.push({
      type: "setViewport",
      width: plan.viewport.width,
      height: plan.viewport.height,
      deviceScaleFactor: plan.viewport.dpr,
      isMobile: mobile,
      hasTouch: mobile,
      isLandscape: plan.viewport.width > plan.viewport.height,
    });
  }
  for (const step of plan.steps) steps.push(...stepsOf(step, options.baseUrl));

  const warnings: string[] = [];
  if (plan.variables.length) {
    warnings.push(
      `The recording format has no variables: masked fields (${plan.variables.join(", ")}) are left empty.`,
    );
  }
  if (plan.stubs.length) {
    warnings.push("Recorded responses are not part of this format; the replay calls the real API.");
  }
  const document = options.complete ? { title: plan.title, steps } : steps;
  return { code: `${JSON.stringify(document, null, 2)}\n`, warnings };
}
