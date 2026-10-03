import type { StepTarget } from "@capuchoo/core";
import { bestCss, hasStableId, joinUrl, textFinds } from "./locators";
import type { ExportPlan, NetworkStub, PlanStep } from "./plan";
import type { ExportOptions, ExportResult } from "./types";

const js = (value: string) => JSON.stringify(value);

/** Cypress's `type` reads `{` as a key; a literal brace is written `{{}`. */
const typed = (value: string) => js(value.replace(/\{/g, "{{}"));

function locate(target: StepTarget): string {
  if (!hasStableId(target) && textFinds(target)) {
    return `cy.contains(${js(target.tag)}, ${js(target.text)})`;
  }
  return `cy.get(${js(bestCss(target))})`;
}

function stub(entry: NetworkStub): string {
  const headers = entry.contentType
    ? `, headers: { "content-type": ${js(entry.contentType)} }`
    : "";
  return `cy.intercept(${js(entry.method)}, ${js(entry.url)}, { statusCode: ${entry.status}, body: ${js(entry.body)}${headers} });`;
}

function command(step: PlanStep, baseUrl: string): string {
  switch (step.kind) {
    case "visit":
      return `cy.visit(${js(joinUrl(baseUrl, step.url))});`;
    case "url":
      return `cy.url().should("include", ${js(step.url)});`;
    case "tap":
      return `${locate(step.target)}.click();`;
    case "type": {
      const field = locate(step.target);
      if (step.variable) {
        return `${field}.clear().type(Cypress.env(${js(step.variable)}), { log: false });`;
      }
      return step.value ? `${field}.clear().type(${typed(step.value)});` : `${field}.clear();`;
    }
    case "check":
      return `${locate(step.target)}.${step.checked ? "check" : "uncheck"}();`;
    case "select":
      return `${locate(step.target)}.select(${step.variable ? `Cypress.env(${js(step.variable)})` : js(step.value)});`;
    case "key":
      return `${locate(step.target)}.type(${js(`{${step.key.toLowerCase()}}`)});`;
  }
}

export function toCypress(plan: ExportPlan, options: ExportOptions): ExportResult {
  const lines = [
    ...(plan.viewport ? [`cy.viewport(${plan.viewport.width}, ${plan.viewport.height});`] : []),
    ...plan.stubs.map(stub),
    ...plan.steps.map((step) => command(step, options.baseUrl)),
  ];
  const warnings = [...plan.notes];
  if (plan.variables.length)
    warnings.push(`Masked values are read from Cypress.env: ${plan.variables.join(", ")}.`);
  if (!options.complete) return { code: `${lines.join("\n")}\n`, warnings };
  const body = lines.map((line) => `    ${line}`).join("\n");
  return {
    code: `describe(${js(plan.title)}, () => {\n  it("replays the recorded steps", () => {\n${body}\n  });\n});\n`,
    warnings,
  };
}
