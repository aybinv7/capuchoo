/**
 * Ported from rrweb-snapshot 2.1.7 - MIT License, Copyright (c) 2018 Contributors
 * (https://github.com/rrweb-io/rrweb/graphs/contributors) and SmartX Inc.
 */

import { absolutifyURLs } from "./css.js";

const SRCSET_NOT_SPACES = /^[^ \t\n\r\f]+/;
const SRCSET_COMMAS_OR_SPACES = /^[, \t\n\r\f]+/;
const anchors = new WeakMap<Document, HTMLAnchorElement>();

export function getHref(doc: Document, customHref?: string): string {
  let anchor = anchors.get(doc);
  if (!anchor) {
    anchor = doc.createElement("a");
    anchors.set(doc, anchor);
  }
  if (!customHref) customHref = "";
  else if (customHref.startsWith("blob:") || customHref.startsWith("data:")) return customHref;
  anchor.setAttribute("href", customHref);
  return anchor.href;
}

function absoluteToDoc(doc: Document, value: string): string {
  if (!value || value.trim() === "") return value;
  return getHref(doc, value);
}

function absoluteSrcset(doc: Document, value: string): string {
  if (value.trim() === "") return value;
  let pos = 0;
  const collect = (pattern: RegExp): string => {
    const match = pattern.exec(value.substring(pos));
    if (!match) return "";
    pos += match[0].length;
    return match[0];
  };
  const output: string[] = [];
  for (;;) {
    collect(SRCSET_COMMAS_OR_SPACES);
    if (pos >= value.length) break;
    let url = collect(SRCSET_NOT_SPACES);
    if (url.slice(-1) === ",") {
      output.push(absoluteToDoc(doc, url.substring(0, url.length - 1)));
      continue;
    }
    let descriptors = "";
    url = absoluteToDoc(doc, url);
    let inParens = false;
    for (;;) {
      const c = value.charAt(pos);
      if (c === "") {
        output.push((url + descriptors).trim());
        break;
      }
      if (!inParens) {
        if (c === ",") {
          pos += 1;
          output.push((url + descriptors).trim());
          break;
        }
        if (c === "(") inParens = true;
      } else if (c === ")") {
        inParens = false;
      }
      descriptors += c;
      pos += 1;
    }
  }
  return output.join(", ");
}

/** An attribute as rrweb records it: relative URLs made absolute. */
export function transformAttribute(
  doc: Document,
  tagName: string,
  name: string,
  value: string,
): string {
  if (!value) return value;
  if (name === "src" || (name === "href" && !(tagName === "use" && value[0] === "#"))) {
    return absoluteToDoc(doc, value);
  }
  if (name === "xlink:href" && value[0] !== "#") return absoluteToDoc(doc, value);
  if (name === "background" && ["table", "td", "th"].includes(tagName)) {
    return absoluteToDoc(doc, value);
  }
  if (name === "srcset") return absoluteSrcset(doc, value);
  if (name === "style") return absolutifyURLs(value, getHref(doc));
  if (tagName === "object" && name === "data") return absoluteToDoc(doc, value);
  return value;
}

export function extractFileExtension(path: string, baseURL?: string): string | null {
  let url: URL;
  try {
    url = new URL(path, baseURL ?? window.location.href);
  } catch {
    return null;
  }
  return /\.([0-9a-z]+)(?:$)/i.exec(url.pathname)?.[1] ?? null;
}
