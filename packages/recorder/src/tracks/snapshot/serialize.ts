/**
 * Ported from rrweb-snapshot 2.1.7 - MIT License, Copyright (c) 2018 Contributors
 * (https://github.com/rrweb-io/rrweb/graphs/contributors) and SmartX Inc.
 */

import { absolutifyURLs, markCssSplits, stringifyStylesheet } from "./css.js";
import {
  IGNORED_NODE,
  NodeKind,
  type Attributes,
  type NodeContext,
  type SerializeSettings,
  type SerializedElement,
  type SerializedNode,
  type SlimDOMOptions,
  type SnapshotMirror,
} from "./types.js";
import { extractFileExtension, getHref, transformAttribute } from "./urls.js";

/**
 * One node at a time, the way rrweb-snapshot 2.1.7's `serializeNodeWithId` writes it, without the
 * recursion: the caller walks the tree, so it can stop between any two nodes. Masking, blocking,
 * slim DOM and attribute rewriting are ported line for line; the recorder never turns on the
 * features left out (inlined stylesheets and images, canvas), and a document holding what rrweb
 * tracks outside the snapshot (iframes, shadow roots) is reported as unsupported instead.
 */

const BLOCK_CLASS = "rr-block";
const MASK_CLASS = "rr-mask";
const TAG_NAME_PATTERN = /[^a-z0-9-_:]/;

export const UNSUPPORTED = Symbol("unsupported");

export interface Shallow {
  node: SerializedNode;
  /** The element matches the block selector: recorded as an empty box, children left out. */
  blocked: boolean;
  /** The element itself matches the mask selector. */
  masked: boolean;
  /** The context this node's children are serialized in. */
  children: NodeContext | null;
}

export function isBlockedElement(element: Element, blockSelector: string): boolean {
  try {
    if (element.classList.contains(BLOCK_CLASS)) return true;
    if (blockSelector) return element.matches(blockSelector);
  } catch {
    return false;
  }
  return false;
}

/** Whether the element matches the mask selector itself, ignoring its ancestors. */
export function matchesMask(element: Element, maskTextSelector: string): boolean {
  try {
    if (element.classList.contains(MASK_CLASS)) return true;
    if (maskTextSelector) return element.matches(maskTextSelector);
  } catch {
    return false;
  }
  return false;
}

function needMaskingText(node: Node, maskTextSelector: string, checkAncestors: boolean): boolean {
  let element: Element;
  if (node.nodeType === Node.ELEMENT_NODE) {
    element = node as Element;
    if (!element.childNodes.length) return false;
  } else {
    const parent = node.parentElement;
    if (parent === null) return false;
    element = parent;
  }
  try {
    if (checkAncestors) {
      if (element.closest(`.${MASK_CLASS}`)) return true;
      if (maskTextSelector && element.closest(maskTextSelector)) return true;
      return false;
    }
    return matchesMask(element, maskTextSelector);
  } catch {
    return false;
  }
}

function validTagName(element: Element): string {
  if (element instanceof HTMLFormElement) return "form";
  const name = element.tagName.toLowerCase();
  return TAG_NAME_PATTERN.test(name) ? "div" : name;
}

function inputType(element: HTMLInputElement): string | null {
  if (element.hasAttribute("data-rr-is-password")) return "password";
  return element.type ? element.type.toLowerCase() : null;
}

function maskInputValue(
  tagName: string,
  type: string | null,
  value: string,
  options: Record<string, boolean>,
): string {
  const actualType = type?.toLowerCase();
  if (options[tagName.toLowerCase()] || (actualType && options[actualType])) {
    return "*".repeat(value.length);
  }
  return value;
}

function rootIdOf(doc: Document, mirror: SnapshotMirror): number | undefined {
  if (!mirror.hasNode(doc)) return undefined;
  const id = mirror.getId(doc);
  return id === 1 ? undefined : id;
}

function serializeElement(
  element: Element,
  doc: Document,
  settings: SerializeSettings,
  rootId: number | undefined,
): { node: SerializedElement; blocked: boolean } {
  const blocked = isBlockedElement(element, settings.blockSelector);
  const tagName = validTagName(element);
  let attributes: Attributes = {};
  const list = element.attributes;
  for (let index = 0; index < list.length; index++) {
    const attr = list[index]!;
    if (["video", "audio"].includes(tagName) && attr.name.toLowerCase() === "autoplay") continue;
    attributes[attr.name] = transformAttribute(doc, tagName, attr.name.toLowerCase(), attr.value);
  }
  if (tagName === "style") {
    const sheet = (element as HTMLStyleElement).sheet;
    if (sheet) {
      let cssText = stringifyStylesheet(sheet);
      if (cssText) {
        if (element.childNodes.length > 1) {
          cssText = markCssSplits(cssText, element as HTMLStyleElement);
        }
        attributes._cssText = cssText;
      }
    }
  }
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    const field = element as HTMLInputElement;
    const { value, checked } = field;
    if (
      attributes.type !== "radio" &&
      attributes.type !== "checkbox" &&
      attributes.type !== "submit" &&
      attributes.type !== "button" &&
      value
    ) {
      attributes.value = maskInputValue(
        tagName,
        inputType(field),
        value,
        settings.maskInputOptions,
      );
    } else if (checked) {
      attributes.checked = checked;
    }
  }
  if (tagName === "option") {
    if ((element as HTMLOptionElement).selected && !settings.maskInputOptions.select) {
      attributes.selected = true;
    } else {
      delete attributes.selected;
    }
  }
  if (tagName === "dialog" && (element as HTMLDialogElement).open) {
    attributes.rr_open_mode = element.matches("dialog:modal") ? "modal" : "non-modal";
  }
  if (tagName === "audio" || tagName === "video") {
    const media = element as HTMLMediaElement;
    attributes.rr_mediaState = media.paused ? "paused" : "played";
    attributes.rr_mediaCurrentTime = media.currentTime;
    attributes.rr_mediaPlaybackRate = media.playbackRate;
    attributes.rr_mediaMuted = media.muted;
    attributes.rr_mediaLoop = media.loop;
    attributes.rr_mediaVolume = media.volume;
  }
  if (element.scrollLeft) attributes.rr_scrollLeft = element.scrollLeft;
  if (element.scrollTop) attributes.rr_scrollTop = element.scrollTop;
  if (blocked) {
    const { width, height } = element.getBoundingClientRect();
    attributes = {
      class: attributes.class,
      rr_width: `${width}px`,
      rr_height: `${height}px`,
    };
  }
  let isCustom: true | undefined;
  try {
    if (customElements.get(tagName)) isCustom = true;
  } catch {
    isCustom = undefined;
  }
  const isSVG = element.tagName === "svg" || (element as SVGElement).ownerSVGElement;
  return {
    node: {
      type: NodeKind.Element,
      tagName,
      attributes,
      childNodes: [],
      isSVG: isSVG ? true : undefined,
      rootId,
      isCustom,
      id: 0,
    },
    blocked,
  };
}

function serializeText(
  text: Node,
  doc: Document,
  needsMask: boolean,
  cssCaptured: boolean,
  rootId: number | undefined,
): SerializedNode {
  const parentTagName = (text.parentNode as Element | null)?.tagName;
  const isStyle = parentTagName === "STYLE";
  const isScript = parentTagName === "SCRIPT";
  let content: string | null = "";
  if (isScript) {
    content = "SCRIPT_PLACEHOLDER";
  } else if (!cssCaptured) {
    content = text.textContent;
    if (isStyle && content) content = absolutifyURLs(content, getHref(doc));
  }
  if (!isStyle && !isScript && content && needsMask) content = content.replace(/[\S]/g, "*");
  return { type: NodeKind.Text, textContent: content || "", rootId, id: 0 };
}

function lower(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function slimDOMExcluded(node: SerializedNode, options: SlimDOMOptions): boolean {
  if (options.comment && node.type === NodeKind.Comment) return true;
  if (node.type !== NodeKind.Element) return false;
  const { tagName, attributes: a } = node;
  if (
    options.script &&
    (tagName === "script" ||
      (tagName === "link" &&
        ((a.rel === "preload" && a.as === "script") || a.rel === "modulepreload")) ||
      (tagName === "link" &&
        a.rel === "prefetch" &&
        typeof a.href === "string" &&
        extractFileExtension(a.href) === "js"))
  ) {
    return true;
  }
  if (
    options.headFavicon &&
    ((tagName === "link" && a.rel === "shortcut icon") ||
      (tagName === "meta" &&
        (/^msapplication-tile(image|color)$/.test(lower(a.name)) ||
          lower(a.name) === "application-name" ||
          lower(a.rel) === "icon" ||
          lower(a.rel) === "apple-touch-icon" ||
          lower(a.rel) === "shortcut icon")))
  ) {
    return true;
  }
  if (tagName !== "meta") return false;
  if (options.headMetaDescKeywords && /^description|keywords$/.test(lower(a.name))) return true;
  if (
    options.headMetaSocial &&
    (/^(og|twitter|fb):/.test(lower(a.property)) ||
      /^(og|twitter):/.test(lower(a.name)) ||
      lower(a.name) === "pinterest")
  ) {
    return true;
  }
  if (options.headMetaRobots && ["robots", "googlebot", "bingbot"].includes(lower(a.name))) {
    return true;
  }
  if (options.headMetaHttpEquiv && a["http-equiv"] !== undefined) return true;
  if (
    options.headMetaAuthorship &&
    (["author", "generator", "framework", "publisher", "progid"].includes(lower(a.name)) ||
      lower(a.property).startsWith("article:") ||
      lower(a.property).startsWith("product:"))
  ) {
    return true;
  }
  return Boolean(
    options.headMetaVerification &&
    [
      "google-site-verification",
      "yandex-verification",
      "csrf-token",
      "p:domain_verify",
      "verify-v1",
      "verification",
      "shopify-checkout-api-token",
    ].includes(lower(a.name)),
  );
}

/**
 * The node's own serialized form, without an id and without its children, or `null` for a node
 * type rrweb does not record. Iframes and shadow hosts are `UNSUPPORTED`: rrweb attaches observers
 * to them while it snapshots, which a snapshot taken outside rrweb cannot do.
 */
export function describeNode(
  node: Node,
  context: NodeContext,
  doc: Document,
  settings: SerializeSettings,
  mirror: SnapshotMirror,
): Shallow | null | typeof UNSUPPORTED {
  const isElement = node.nodeType === Node.ELEMENT_NODE;
  const masked = isElement && matchesMask(node as Element, settings.maskTextSelector);
  let needsMask = context.needsMask;
  if (needsMask === undefined) {
    needsMask = needMaskingText(node, settings.maskTextSelector, true);
  } else if (!needsMask) {
    needsMask = isElement
      ? node.childNodes.length > 0 && masked
      : needMaskingText(node, settings.maskTextSelector, false);
  }
  const rootId = rootIdOf(doc, mirror);
  switch (node.nodeType) {
    case Node.DOCUMENT_NODE: {
      const compatMode = (node as Document).compatMode;
      return {
        node:
          compatMode !== "CSS1Compat"
            ? { type: NodeKind.Document, childNodes: [], compatMode, id: 0 }
            : { type: NodeKind.Document, childNodes: [], id: 0 },
        blocked: false,
        masked,
        children: { needsMask, preserveWhiteSpace: context.preserveWhiteSpace, cssCaptured: false },
      };
    }
    case Node.DOCUMENT_TYPE_NODE: {
      const doctype = node as DocumentType;
      return {
        node: {
          type: NodeKind.DocumentType,
          name: doctype.name,
          publicId: doctype.publicId,
          systemId: doctype.systemId,
          rootId,
          id: 0,
        },
        blocked: false,
        masked,
        children: null,
      };
    }
    case Node.ELEMENT_NODE: {
      const element = node as Element;
      if (element.tagName === "IFRAME" || element.shadowRoot) return UNSUPPORTED;
      const { node: serialized, blocked } = serializeElement(element, doc, settings, rootId);
      const skipChildren =
        blocked || (serialized.tagName === "textarea" && serialized.attributes.value !== undefined);
      const preserveWhiteSpace =
        context.preserveWhiteSpace &&
        !(settings.slimDOM.headWhitespace && serialized.tagName === "head");
      return {
        node: serialized,
        blocked,
        masked,
        children: skipChildren
          ? null
          : {
              needsMask,
              preserveWhiteSpace,
              cssCaptured: typeof serialized.attributes._cssText === "string",
            },
      };
    }
    case Node.TEXT_NODE:
      return {
        node: serializeText(node, doc, needsMask, context.cssCaptured, rootId),
        blocked: false,
        masked,
        children: null,
      };
    case Node.CDATA_SECTION_NODE:
      return {
        node: { type: NodeKind.CDATA, textContent: "", rootId, id: 0 },
        blocked: false,
        masked,
        children: null,
      };
    case Node.COMMENT_NODE:
      return {
        node: { type: NodeKind.Comment, textContent: node.textContent || "", rootId, id: 0 },
        blocked: false,
        masked,
        children: null,
      };
    default:
      return null;
  }
}

/**
 * Gives the node its id - the one rrweb already knows it by, or a new one - and records it in the
 * mirror. `false` when rrweb leaves the node out.
 */
export function registerNode(
  node: Node,
  serialized: SerializedNode,
  context: NodeContext,
  settings: SerializeSettings,
  mirror: SnapshotMirror,
  allocateId: () => number,
): boolean {
  let id: number;
  if (mirror.hasNode(node)) {
    id = mirror.getId(node);
  } else if (
    slimDOMExcluded(serialized, settings.slimDOM) ||
    (!context.preserveWhiteSpace &&
      serialized.type === NodeKind.Text &&
      !serialized.textContent.replace(/^\s+|\s+$/gm, "").length)
  ) {
    id = IGNORED_NODE;
  } else {
    id = allocateId();
  }
  serialized.id = id;
  mirror.add(node, serialized);
  return id !== IGNORED_NODE;
}
