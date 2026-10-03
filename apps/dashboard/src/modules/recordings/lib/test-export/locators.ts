import type { StepTarget } from "@capuchoo/core";

const quoteAttribute = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** A CSS id selector, escaped the way `CSS.escape` would for the characters ids actually hold. */
const idSelector = (id: string) =>
  `#${id.replace(/^(\d)/, "\\3$1 ").replace(/([^A-Za-z0-9_-])/g, "\\$1")}`;

/**
 * The single CSS selector that best survives a redesign: a test id, a stable id, then the path
 * recorded with the step. Every option was unique on the page when the step happened.
 */
export function bestCss(target: StepTarget): string {
  if (target.testId && target.unique.testId) {
    return `[${target.testId.attribute}=${quoteAttribute(target.testId.value)}]`;
  }
  if (target.id && target.unique.id) return idSelector(target.id);
  return target.css;
}

/** Whether a test can find the element by its text alone and be sure it is this one. */
export const textFinds = (target: StepTarget): target is StepTarget & { text: string } =>
  Boolean(target.text && target.unique.text);

/** Whether the element has an identifier made for, or stable enough for, tests. */
export const hasStableId = (target: StepTarget): boolean =>
  Boolean((target.testId && target.unique.testId) || (target.id && target.unique.id));

/**
 * Selector alternatives in Chrome Recorder's syntax, best first; the player tries each in turn.
 * The recorded path comes before names and text, which Chrome matches across the whole page; an
 * accessible name is offered only when it came from a label rather than the visible text.
 */
export function recorderSelectors(target: StepTarget): string[][] {
  const selectors: string[][] = [];
  if (hasStableId(target)) selectors.push([bestCss(target)]);
  if (!selectors.some(([selector]) => selector === target.css)) selectors.push([target.css]);
  if (target.name && target.name !== target.text) selectors.push([`aria/${target.name}`]);
  if (textFinds(target)) selectors.push([`text/${target.text}`]);
  return selectors;
}

/** The app's address for a recorded route, whatever slashes either side brings. */
export function joinUrl(base: string, route: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(route)) return route;
  return `${base.replace(/\/+$/, "")}/${route.replace(/^\/+/, "")}`;
}
