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
 * The accessible name comes first only when the text behind it was unique.
 */
export function recorderSelectors(target: StepTarget): string[][] {
  const selectors: string[][] = [];
  if (hasStableId(target)) selectors.push([bestCss(target)]);
  if (target.name && textFinds(target)) selectors.push([`aria/${target.name}`]);
  if (!selectors.some(([selector]) => selector === target.css)) selectors.push([target.css]);
  if (textFinds(target)) selectors.push([`text/${target.text}`]);
  return selectors;
}

/** A regular expression literal that matches exactly this text, ignoring surrounding space. */
export function exactText(text: string): string {
  const escaped = text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return `/^\\s*${escaped}\\s*$/`;
}

/** The app's address for a recorded route, whatever slashes either side brings. */
export function joinUrl(base: string, route: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(route)) return route;
  return `${base.replace(/\/+$/, "")}/${route.replace(/^\/+/, "")}`;
}
