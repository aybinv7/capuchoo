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
  attributes?: Record<string, unknown>;
  childNodes?: SerializedNode[];
}

function rewriteNode(node: SerializedNode | undefined, assets: AssetMap): void {
  if (!node) return;
  if (node.attributes) rewriteAttributes(node.attributes, assets);
  for (const child of node.childNodes ?? []) rewriteNode(child, assets);
}

function rewriteAttributes(attributes: Record<string, unknown>, assets: AssetMap): void {
  for (const name of URL_ATTRIBUTES) {
    const value = attributes[name];
    if (typeof value !== "string") continue;
    const resolved = resolveAsset(value, assets);
    if (resolved) attributes[name] = resolved;
  }
  if (typeof attributes.srcset === "string") delete attributes.srcset;
}

const FULL_SNAPSHOT = 2;
const INCREMENTAL = 3;
const MUTATION = 0;

/**
 * Points every stylesheet and image a replay references at the copy the server holds for that app
 * version. Mutates in place: the events are the player's own copy, built once per segment.
 */
export function rewriteReplayEvent(event: { type: number; data: unknown }, assets: AssetMap): void {
  if (assets.size === 0) return;
  const data = event.data as {
    node?: SerializedNode;
    source?: number;
    adds?: Array<{ node?: SerializedNode }>;
    attributes?: Array<{ attributes?: Record<string, unknown> }>;
  };
  if (event.type === FULL_SNAPSHOT) {
    rewriteNode(data.node, assets);
    return;
  }
  if (event.type === INCREMENTAL && data.source === MUTATION) {
    for (const add of data.adds ?? []) rewriteNode(add.node, assets);
    for (const change of data.attributes ?? []) {
      if (change.attributes) rewriteAttributes(change.attributes, assets);
    }
  }
}

/** A stylesheet's `url()` references, resolved against where it lived on the device. */
export function rewriteCss(css: string, cssPath: string, assets: AssetMap): string {
  return css.replace(CSS_URL, (match, quote: string, raw: string) => {
    const path = pathOf(raw.trim(), `https://app.invalid${cssPath}`);
    const resolved = path ? assets.get(path) : undefined;
    return resolved ? `url(${quote}${resolved}${quote})` : match;
  });
}
