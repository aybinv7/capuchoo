import { targetName } from "../steps";
import { bestCss } from "./locators";
import type { ExportPlan, PlanStep } from "./plan";
import type { ExportOptions, ExportResult } from "./types";

/** A step of a Capubridge flow document, version 1. */
type FlowStep = Record<string, unknown> & { id: string; op: string };

const ROOT_ROUTES = new Set(["", "/", "/#", "/#/", "/#!/", "/index.html"]);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Capubridge drives the installed app on a real phone through its WebView, so a step finds its
 * element by CSS selector and a route is checked against the WebView's URL. What the phone cannot
 * do - open a URL, answer with a recorded response, choose in a native picker - is reported.
 */
export function toCapubridge(
  plan: ExportPlan,
  options: ExportOptions,
  newId: () => string = () => crypto.randomUUID(),
): ExportResult {
  const warnings = new Set<string>(plan.notes);
  const steps: FlowStep[] = [];
  let count = 0;
  const add = (step: Omit<FlowStep, "id">) =>
    steps.push({ id: `step-${++count}`, ...step } as FlowStep);

  const convert = (step: PlanStep) => {
    switch (step.kind) {
      case "visit":
        add({ op: "openApp", packageName: options.appPackage, label: "Open the app" });
        if (!ROOT_ROUTES.has(step.url)) {
          warnings.add(
            `The recording starts at ${step.url}; the flow starts wherever the app opens.`,
          );
        }
        return;
      case "url":
        add({
          op: "assert",
          assertion: { kind: "urlMatches", pattern: escapeRegex(step.url) },
          label: `Arrived at ${step.url}`,
        });
        return;
      case "tap":
      case "check":
        add({
          op: "tap",
          target: { kind: "selector", cssSelector: bestCss(step.target) },
          label: `Tap "${targetName(step.target)}"`,
        });
        return;
      case "type":
        if (step.variable) {
          warnings.add(`Flows have no variables: the masked ${step.variable} is typed empty.`);
        }
        add({
          op: "type",
          target: { kind: "selector", cssSelector: bestCss(step.target) },
          text: step.variable ? "" : step.value,
          label: `Type in ${targetName(step.target)}`,
        });
        return;
      case "select":
        warnings.add("Flows cannot choose in a native picker; choices are left out.");
        return;
      case "key":
        add({
          op: "pressKey",
          keycode: `KEYCODE_${step.key.toUpperCase()}`,
          label: `Press ${step.key}`,
        });
        return;
    }
  };
  for (const step of plan.steps) convert(step);

  if (plan.stubs.length) {
    warnings.add("The phone calls the real API; recorded responses are not replayed.");
  }
  if (!options.appPackage) warnings.add("Set the app's package so the flow can open it.");

  const document = options.complete
    ? {
        version: 1,
        id: newId(),
        name: plan.title,
        appPackage: options.appPackage,
        description: "Exported from a Capuchoo session recording.",
        steps,
      }
    : steps;
  return { code: `${JSON.stringify(document, null, 2)}\n`, warnings: [...warnings] };
}
