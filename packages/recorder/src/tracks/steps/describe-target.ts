import type { StepTarget } from "@capuchoo/core";

const TEST_ATTRIBUTES = ["data-testid", "data-test", "data-cy", "data-qa"] as const;
const MAX_TEXT = 80;
/** Text longer than this belongs to a container, not to what was tapped. */
const MAX_OWN_TEXT = 200;
/** Elements compared when checking that a text names one element; past it, it is not relied on. */
const MAX_TEXT_SCAN = 400;
const MAX_DEPTH = 8;
/** Ids a framework or a build generated: they change between runs, so a test cannot rely on them. */
const GENERATED_ID = /\d{3,}|[0-9a-f]{8,}|^(?:ember|react|vue|v-|el-|f7-|ion-|mui-|radix-|reka-)/i;
/** Classes that describe a moment rather than an element. */
const STATE_CLASS =
  /(?:^|-)(?:active|focus(?:ed)?|hover(?:ed)?|pressed|selected|disabled|open|visible|hidden|ripple|transitioning|animat\w*)$/i;

const IMPLICIT_ROLES: Record<string, string> = {
  BUTTON: "button",
  A: "link",
  SELECT: "combobox",
  TEXTAREA: "textbox",
  IMG: "img",
  H1: "heading",
  H2: "heading",
  H3: "heading",
  LI: "listitem",
};

const INPUT_ROLES: Record<string, string> = {
  button: "button",
  submit: "button",
  reset: "button",
  checkbox: "checkbox",
  radio: "radio",
  range: "slider",
  search: "searchbox",
};

export interface DescribeOptions {
  /** Text inside matching elements is never read. */
  maskTextSelector: string;
}

const collapse = (value: string | null | undefined): string | null => {
  if (!value || value.length > MAX_OWN_TEXT * 4) return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
};

function roleOf(element: Element): string | null {
  const explicit = element.getAttribute("role");
  if (explicit) return explicit.split(/\s+/)[0] ?? null;
  if (element instanceof HTMLInputElement) return INPUT_ROLES[element.type] ?? "textbox";
  if (element.tagName === "A" && !element.hasAttribute("href")) return null;
  return IMPLICIT_ROLES[element.tagName] ?? null;
}

function labelText(element: Element): string | null {
  if (
    !(
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    )
  ) {
    return null;
  }
  const labels = element.labels;
  if (labels && labels.length > 0) return collapse(labels[0]!.textContent);
  return collapse(element.getAttribute("placeholder"));
}

function nameOf(element: Element, masked: boolean): string | null {
  const aria = collapse(element.getAttribute("aria-label"));
  if (aria) return aria;
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy && !masked) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? "")
      .join(" ");
    const name = collapse(text);
    if (name) return name;
  }
  const label = labelText(element);
  if (label) return label;
  const alt = collapse(element.getAttribute("alt") ?? element.getAttribute("title"));
  if (alt) return alt;
  if (masked || element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return null;
  }
  return ownText(element);
}

function testIdOf(element: Element): { attribute: string; value: string } | null {
  for (const attribute of TEST_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (value) return { attribute, value };
  }
  return null;
}

function stableId(element: Element): string | null {
  const id = element.id;
  return id && !GENERATED_ID.test(id) ? id : null;
}

const quote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

function isUnique(root: Document, selector: string): boolean {
  try {
    return root.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/** One element's own part of a CSS path: tag, up to two lasting classes, and its place among siblings. */
function segmentOf(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const classes = Array.from(element.classList)
    .filter((name) => !STATE_CLASS.test(name) && !GENERATED_ID.test(name))
    .slice(0, 2)
    .map((name) => `.${CSS.escape(name)}`)
    .join("");
  const parent = element.parentElement;
  if (!parent) return `${tag}${classes}`;
  const sameTag = Array.from(parent.children).filter((child) => child.tagName === element.tagName);
  if (sameTag.length === 1) return `${tag}${classes}`;
  return `${tag}${classes}:nth-of-type(${sameTag.indexOf(element) + 1})`;
}

/** The shortest unique CSS path, anchored on the nearest test id or stable id above the element. */
export function cssPathOf(element: Element): string {
  const root = element.ownerDocument;
  const parts: string[] = [];
  let current: Element | null = element;
  for (let depth = 0; current && depth < MAX_DEPTH; depth++) {
    const test = testIdOf(current);
    const id = stableId(current);
    const anchor = test
      ? `[${test.attribute}=${quote(test.value)}]`
      : id
        ? `#${CSS.escape(id)}`
        : null;
    if (anchor) {
      const candidate = [anchor, ...parts].join(" > ");
      if (isUnique(root, candidate)) return candidate;
    }
    parts.unshift(segmentOf(current));
    const path = parts.join(" > ");
    if (isUnique(root, path)) return path;
    current = current.parentElement;
  }
  return parts.join(" > ");
}

/** The element's text when it is short enough to name it, as a person would read it. */
function ownText(element: Element): string | null {
  const raw = element.textContent;
  if (!raw || raw.length > MAX_OWN_TEXT * 4) return null;
  const text = collapse(raw);
  return text && text.length <= MAX_OWN_TEXT ? text : null;
}

function textIsUnique(root: Document, tag: string, text: string): boolean {
  const candidates = root.getElementsByTagName(tag);
  if (candidates.length > MAX_TEXT_SCAN) return false;
  let count = 0;
  for (const candidate of Array.from(candidates)) {
    if (ownText(candidate) === text && ++count > 1) return false;
  }
  return count === 1;
}

/**
 * Every way a test could find the element again, worked out while it is still on the page: a test
 * id, a stable id, its role and accessible name, its text and a unique CSS path. Each comes with
 * whether it alone finds exactly this element, so an exporter picks the best one that holds.
 */
export function describeTarget(element: Element, options: DescribeOptions): StepTarget {
  const root = element.ownerDocument;
  const masked = Boolean(options.maskTextSelector && element.closest(options.maskTextSelector));
  const test = testIdOf(element);
  const id = stableId(element);
  const role = roleOf(element);
  const name = nameOf(element, masked);
  const text = masked || element instanceof HTMLInputElement ? null : ownText(element);
  const tag = element.tagName.toLowerCase();
  return {
    tag,
    role,
    name,
    text,
    testId: test ? { attribute: test.attribute, value: test.value } : null,
    id,
    css: cssPathOf(element),
    unique: {
      testId: test ? isUnique(root, `[${test.attribute}=${quote(test.value)}]`) : false,
      id: id ? isUnique(root, `#${CSS.escape(id)}`) : false,
      text: text ? textIsUnique(root, tag, text) : false,
    },
    inputType: element instanceof HTMLInputElement ? element.type : null,
  };
}
