import type { StepTarget } from "@capuchoo/core";

const TEST_ATTRIBUTES = ["data-testid", "data-test", "data-cy", "data-qa"] as const;
const MAX_LABEL = 80;
/** Text longer than this belongs to a container, not to what was tapped. */
const MAX_OWN_TEXT = 200;
/** Elements compared when checking that a text names one element; past it, it is not relied on. */
const MAX_TEXT_SCAN = 400;
const MAX_DEPTH = 8;
/** Ids a framework or a build generated: they change between runs, so a test cannot rely on them. */
const GENERATED_ID = /\d{3,}|[0-9a-f]{8,}|^(?:ember|react|vue|v-|el-|f7-|ion-|mui-|radix-|reka-)/i;
/**
 * Words that make a class describe a moment rather than an element: Framework7's `active-state`
 * while a finger is down, `page-current`, `input-with-value`, `searchbar-backdrop-in`, and the like.
 */
const STATE_WORDS = new Set([
  "active",
  "current",
  "previous",
  "next",
  "focus",
  "focused",
  "hover",
  "hovered",
  "pressed",
  "selected",
  "disabled",
  "enabled",
  "open",
  "opened",
  "closed",
  "visible",
  "hidden",
  "show",
  "shown",
  "ripple",
  "transitioning",
  "animating",
  "animated",
  "checked",
  "empty",
  "loading",
  "loaded",
  "expanded",
  "collapsed",
  "in",
  "out",
  "state",
  "value",
  "valid",
  "invalid",
  "dirty",
  "touched",
  "pristine",
]);
/** Icon glyphs: an icon font writes its glyph's name as text, which is not what a person reads. */
const ICON =
  'i, svg, [aria-hidden="true"], .icon, .material-icons, .material-symbols-outlined, .material-symbols-rounded, .f7-icons, ion-icon';

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

const squash = (value: string) => value.replace(/\s+/g, " ").trim();
const clip = (value: string) =>
  value.length > MAX_LABEL ? `${value.slice(0, MAX_LABEL - 1)}…` : value;

function attributeText(value: string | null): string | null {
  if (!value) return null;
  const text = squash(value);
  return text ? clip(text) : null;
}

/**
 * The text a person reads on the element, in pieces: each text node on its own, icons left out.
 * Null when there is more than a control would hold.
 */
function textPieces(element: Element): string[] | null {
  const walker = element.ownerDocument.createTreeWalker(
    element,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        node.nodeType === Node.ELEMENT_NODE
          ? (node as Element).matches(ICON)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_SKIP
          : NodeFilter.FILTER_ACCEPT,
    },
  );
  const pieces: string[] = [];
  let total = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const piece = squash(node.nodeValue ?? "");
    if (!piece) continue;
    total += piece.length;
    if (total > MAX_OWN_TEXT) return null;
    pieces.push(piece);
  }
  return pieces;
}

const ICON_NAME = /^[a-z][\w-]{0,31}$/i;

/**
 * The icon an element shows, by name: an icon font's ligature (`search`, `arrow_left`), or an
 * `icon-…` class (`icon-back`). What a person would call a button with no text.
 */
function iconOf(element: Element): string | null {
  const icon = element.matches(ICON) ? element : element.querySelector(ICON);
  if (!icon) return null;
  const glyph = squash(icon.textContent ?? "");
  if (ICON_NAME.test(glyph)) return glyph;
  for (const name of Array.from(icon.classList)) {
    const match = /^icon-([a-z][\w-]{0,31})$/i.exec(name);
    if (match) return match[1]!;
  }
  return null;
}

function roleOf(element: Element): string | null {
  const explicit = element.getAttribute("role");
  if (explicit) return explicit.split(/\s+/)[0] ?? null;
  if (element instanceof HTMLInputElement) return INPUT_ROLES[element.type] ?? "textbox";
  if (element.tagName === "A" && !element.hasAttribute("href")) return null;
  return IMPLICIT_ROLES[element.tagName] ?? null;
}

function labelOf(element: Element): string | null {
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
  if (labels && labels.length > 0) {
    const pieces = textPieces(labels[0]!);
    if (pieces?.length) return clip(pieces.join(" "));
  }
  return attributeText(element.getAttribute("placeholder"));
}

function nameOf(element: Element, text: string | null, masked: boolean): string | null {
  const aria = attributeText(element.getAttribute("aria-label"));
  if (aria) return aria;
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy && !masked) {
    const named = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id))
      .flatMap((node) => (node ? (textPieces(node) ?? []) : []))
      .join(" ");
    if (named) return clip(named);
  }
  const label = labelOf(element);
  if (label) return label;
  const alt = attributeText(element.getAttribute("alt") ?? element.getAttribute("title"));
  if (alt) return alt;
  return masked ? null : text;
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

const isStateClass = (name: string) =>
  name.split(/[-_]/).some((word) => STATE_WORDS.has(word.toLowerCase()));

const quote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

function isUnique(root: Document, selector: string): boolean {
  try {
    return root.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/** The two lasting classes fewest elements share, which say most about this one. */
function telling(element: Element): string[] {
  const root = element.ownerDocument;
  return Array.from(element.classList)
    .filter((name) => !isStateClass(name) && !GENERATED_ID.test(name))
    .map((name) => ({ name, count: root.getElementsByClassName(name).length }))
    .sort((a, b) => a.count - b.count)
    .slice(0, 2)
    .map(({ name }) => name);
}

/** One element's own part of a CSS path: tag, its telling classes, and its place among siblings. */
function segmentOf(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const classes = telling(element)
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

/**
 * Whether a test finding a `tag` that contains this text can only land on this element: no other
 * one's text contains it. Containment rather than equality, because test tools match that way.
 */
function textIsUnique(element: Element, tag: string, text: string): boolean {
  const candidates = element.ownerDocument.getElementsByTagName(tag);
  if (candidates.length > MAX_TEXT_SCAN) return false;
  for (const candidate of Array.from(candidates)) {
    if (candidate === element) continue;
    const pieces = textPieces(candidate);
    if (pieces === null || pieces.join(" ").includes(text)) return false;
  }
  return true;
}

/**
 * Every way a test could find the element again, worked out while it is still on the page: a test
 * id, a stable id, its role and accessible name, its text and a unique CSS path. Each comes with
 * whether it alone finds exactly this element, so an exporter picks the best one that holds. Text
 * only counts as a locator when it is one piece: across pieces, tools disagree on the spacing.
 */
export function describeTarget(element: Element, options: DescribeOptions): StepTarget {
  const masked = Boolean(options.maskTextSelector && element.closest(options.maskTextSelector));
  const field = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
  const pieces = masked || field ? null : textPieces(element);
  const text = pieces?.length ? clip(pieces.join(" ")) : null;
  const test = testIdOf(element);
  const id = stableId(element);
  const tag = element.tagName.toLowerCase();
  const root = element.ownerDocument;
  return {
    tag,
    role: roleOf(element),
    name: nameOf(element, text, masked),
    text,
    testId: test ? { attribute: test.attribute, value: test.value } : null,
    id,
    css: cssPathOf(element),
    unique: {
      testId: test ? isUnique(root, `[${test.attribute}=${quote(test.value)}]`) : false,
      id: id ? isUnique(root, `#${CSS.escape(id)}`) : false,
      text:
        pieces?.length === 1 && text !== null && !text.endsWith("…")
          ? textIsUnique(element, tag, text)
          : false,
    },
    inputType: element instanceof HTMLInputElement ? element.type : null,
    icon: text ? null : iconOf(element),
  };
}
