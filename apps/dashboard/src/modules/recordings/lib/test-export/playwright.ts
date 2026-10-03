import type { StepTarget } from "@capuchoo/core";
import { bestCss, hasStableId, joinUrl, textFinds } from "./locators";
import type { ExportPlan, NetworkStub, PlanStep } from "./plan";
import type { ExportOptions, ExportResult } from "./types";

const js = (value: string) => JSON.stringify(value);

/**
 * Playwright's own locators where they are certain to find this one element: a `data-testid`, a
 * stable id, or the element's tag holding its text - the same containment the recorder checked was
 * unique. A CSS selector otherwise.
 */
function locate(target: StepTarget): string {
  if (target.testId?.attribute === "data-testid" && target.unique.testId) {
    return `page.getByTestId(${js(target.testId.value)})`;
  }
  if (hasStableId(target)) return `page.locator(${js(bestCss(target))})`;
  if (textFinds(target)) {
    return `page.locator(${js(target.tag)}).filter({ hasText: ${js(target.text)} })`;
  }
  return `page.locator(${js(target.css)})`;
}

const secret = (variable: string) => `process.env[${js(variable)}] ?? ""`;

function stub(entry: NetworkStub): string {
  const type = entry.contentType ? `, contentType: ${js(entry.contentType)}` : "";
  return `await page.route(${js(entry.url)}, (route) =>\n  route.request().method() === ${js(entry.method)}\n    ? route.fulfill({ status: ${entry.status}${type}, body: ${js(entry.body)} })\n    : route.fallback(),\n);`;
}

function command(step: PlanStep, baseUrl: string): string {
  switch (step.kind) {
    case "visit":
      return `await page.goto(${js(joinUrl(baseUrl, step.url))});`;
    case "url":
      return `await page.waitForURL((url) => url.href.includes(${js(step.url)}));`;
    case "tap":
      return `await ${locate(step.target)}.click();`;
    case "type":
      return `await ${locate(step.target)}.fill(${step.variable ? secret(step.variable) : js(step.value)});`;
    case "check":
      return `await ${locate(step.target)}.${step.checked ? "check" : "uncheck"}();`;
    case "select":
      return `await ${locate(step.target)}.selectOption(${step.variable ? secret(step.variable) : js(step.value)});`;
    case "key":
      return `await ${locate(step.target)}.press(${js(step.key)});`;
  }
}

function deviceOptions(plan: ExportPlan): string | null {
  if (!plan.viewport) return null;
  const { width, height, dpr } = plan.viewport;
  const mobile = plan.platform === "web" ? "" : ", isMobile: true, hasTouch: true";
  return `test.use({ viewport: { width: ${width}, height: ${height} }, deviceScaleFactor: ${dpr}${mobile} });`;
}

export function toPlaywright(plan: ExportPlan, options: ExportOptions): ExportResult {
  const lines = [
    ...plan.stubs.map(stub),
    ...plan.steps.map((step) => command(step, options.baseUrl)),
  ].flatMap((line) => line.split("\n"));
  const warnings = [...plan.notes];
  if (plan.variables.length)
    warnings.push(
      `Masked values are read from environment variables: ${plan.variables.join(", ")}.`,
    );
  if (!options.complete) return { code: `${lines.join("\n")}\n`, warnings };
  const device = deviceOptions(plan);
  const body = lines.map((line) => `  ${line}`).join("\n");
  return {
    code: [
      `import { test } from "@playwright/test";`,
      "",
      ...(device ? [device, ""] : []),
      `test(${js(plan.title)}, async ({ page }) => {`,
      body,
      "});",
      "",
    ].join("\n"),
    warnings,
  };
}
