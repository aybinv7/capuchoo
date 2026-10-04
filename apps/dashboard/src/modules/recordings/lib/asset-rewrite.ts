import type { SafeArea } from "@capuchoo/core";
import { withSafeArea } from "./safe-area";

/** Path on the app's origin to the URL the dashboard serves it from. */
export type AssetMap = ReadonlyMap<string, string>;

const URL_ATTRIBUTES = ["href", "src"] as const;
const CSS_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

function pathOf(raw: string, base?: string): string | null {
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:") || raw.startsWith("#"))
    return null;
  try {
    return new URL(raw, base ?? "https://app.invalid/").pathname;
  } catch {
    return null;
  }
}

/** The dashboard URL for a URL recorded on the device, if the server holds that file. */
export function resolveAsset(raw: string, assets: AssetMap): string | null {
  const path = pathOf(raw);
  return path ? (assets.get(path) ?? null) : null;
}

interface SerializedNode {
  type?: number;
  tagName?: string;
  textContent?: string;
  attributes?: Record<string, unknown>;
  childNodes?: SerializedNode[];
}

const CSS_ATTRIBUTES = ["style", "_cssText"] as const;

function rewriteNode(
  node: SerializedNode | undefined,
  assets: AssetMap,
  safeArea: SafeArea | null,
): void {
  if (!node) return;
  if (node.attributes) rewriteAttributes(node.attributes, assets, safeArea);
  if (safeArea && typeof node.textContent === "string") {
    node.textContent = withSafeArea(node.textContent, safeArea);
  }
  for (const child of node.childNodes ?? []) rewriteNode(child, assets, safeArea);
}

function rewriteAttributes(
  attributes: Record<string, unknown>,
  assets: AssetMap,
  safeArea: SafeArea | null,
): void {
  for (const name of URL_ATTRIBUTES) {
    const value = attributes[name];
    if (typeof value !== "string") continue;
    const resolved = resolveAsset(value, assets);
    if (resolved) attributes[name] = resolved;
  }
  if (typeof attributes.srcset === "string") delete attributes.srcset;
  if (!safeArea) return;
  for (const name of CSS_ATTRIBUTES) {
    const value = attributes[name];
    if (typeof value === "string") attributes[name] = withSafeArea(value, safeArea);
  }
  const style = attributes.style;
  if (style && typeof style === "object") {
    const declarations = style as Record<string, unknown>;
    for (const [property, value] of Object.entries(declarations)) {
      if (typeof value === "string") declarations[property] = withSafeArea(value, safeArea);
    }
  }
}

const FULL_SNAPSHOT = 2;
const INCREMENTAL = 3;
const MUTATION = 0;
const STYLE_SHEET_RULE = 8;

/**
 * Points every stylesheet and image a replay references at the copy the server holds for that app
 * version, and gives inline styles the safe-area insets the phone had. Mutates in place: the events
 * are the player's own copy, built once per segment.
 */
export function rewriteReplayEvent(
  event: { type: number; data: unknown },
  assets: AssetMap,
  safeArea: SafeArea | null = null,
): void {
  if (assets.size === 0 && !safeArea) return;
  const data = event.data as {
    node?: SerializedNode;
    source?: number;
    adds?: Array<{ node?: SerializedNode; rule?: unknown }>;
    attributes?: Array<{ attributes?: Record<string, unknown> }>;
    texts?: Array<{ value?: unknown }>;
  };
  if (event.type === FULL_SNAPSHOT) {
    rewriteNode(data.node, assets, safeArea);
    return;
  }
  if (event.type !== INCREMENTAL) return;
  if (data.source === MUTATION) {
    for (const add of data.adds ?? []) rewriteNode(add.node, assets, safeArea);
    for (const change of data.attributes ?? []) {
      if (change.attributes) rewriteAttributes(change.attributes, assets, safeArea);
    }
    if (safeArea) {
      for (const text of data.texts ?? []) {
        if (typeof text.value === "string") text.value = withSafeArea(text.value, safeArea);
      }
    }
    return;
  }
  if (data.source === STYLE_SHEET_RULE && safeArea) {
    for (const add of data.adds ?? []) {
      if (typeof add.rule === "string") add.rule = withSafeArea(add.rule, safeArea);
    }
  }
}

/**
 * A stylesheet's `url()` references, resolved against where it lived on the device, and its
 * safe-area insets as the phone resolved them.
 */
export function rewriteCss(
  css: string,
  cssPath: string,
  assets: AssetMap,
  safeArea: SafeArea | null = null,
): string {
  return withSafeArea(css, safeArea).replace(CSS_URL, (match, quote: string, raw: string) => {
    const path = pathOf(raw.trim(), `https://app.invalid${cssPath}`);
    const resolved = path ? assets.get(path) : undefined;
    return resolved ? `url(${quote}${resolved}${quote})` : match;
  });
}
