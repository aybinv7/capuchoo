/**
 * Ported from rrweb-snapshot 2.1.7 - MIT License, Copyright (c) 2018 Contributors
 * (https://github.com/rrweb-io/rrweb/graphs/contributors) and SmartX Inc.
 *
 * A `<style>` element is recorded with the text of its parsed sheet, its relative `url()`s made
 * absolute, exactly as rrweb writes it.
 */

const URL_IN_CSS_REF = /url\((?:(')([^']*)'|(")(.*?)"|([^)]*))\)/gm;
const URL_PROTOCOL_MATCH = /^(?:[a-z+]+:)?\/\//i;
const URL_WWW_MATCH = /^www\..*/i;
const DATA_URI = /^(data:)([^,]*),(.*)/i;
const SAFARI_COLONS = /(\[(?:[\w-]+)[^\\])(:(?:[\w-]+)\])/gm;
const CSS_NORMALIZE = /(?:\/\*[^*]*\*\/)|[\s;]|\b(0)px?/g;

function extractOrigin(url: string): string {
  const origin = url.indexOf("//") > -1 ? url.split("/").slice(0, 3).join("/") : url.split("/")[0];
  return (origin ?? "").split("?")[0] ?? "";
}

export function absolutifyURLs(cssText: string | null, href: string): string {
  return (cssText || "").replace(
    URL_IN_CSS_REF,
    (
      origin: string,
      quote1?: string,
      path1?: string,
      quote2?: string,
      path2?: string,
      path3?: string,
    ) => {
      const filePath = path1 || path2 || path3;
      const maybeQuote = quote1 || quote2 || "";
      if (!filePath) return origin;
      if (URL_PROTOCOL_MATCH.test(filePath) || URL_WWW_MATCH.test(filePath)) {
        return `url(${maybeQuote}${filePath}${maybeQuote})`;
      }
      if (DATA_URI.test(filePath)) return `url(${maybeQuote}${filePath}${maybeQuote})`;
      if (filePath[0] === "/") {
        return `url(${maybeQuote}${extractOrigin(href) + filePath}${maybeQuote})`;
      }
      const filePathNoHash = filePath.split("#")[0] ?? "";
      const maybeHash = filePath.substring(filePathNoHash.length);
      const stack = (href.split("#")[0] ?? "").split("/");
      stack.pop();
      for (const part of filePathNoHash.split("/")) {
        if (part === ".") continue;
        if (part === "..") stack.pop();
        else stack.push(part);
      }
      return `url(${maybeQuote}${stack.join("/")}${maybeHash}${maybeQuote})`;
    },
  );
}

function fixBrowserCompatibilityIssuesInCSS(cssText: string): string {
  if (
    cssText.includes(" background-clip: text;") &&
    !cssText.includes(" -webkit-background-clip: text;")
  ) {
    return cssText.replace(
      /\sbackground-clip:\s*text;/g,
      " -webkit-background-clip: text; background-clip: text;",
    );
  }
  return cssText;
}

function escapeImportStatement(rule: CSSImportRule): string {
  const { cssText } = rule;
  if (cssText.split('"').length < 3) return cssText;
  const statement = ["@import", `url(${JSON.stringify(rule.href)})`];
  const layered = rule as CSSImportRule & { layerName?: string | null; supportsText?: string };
  if (layered.layerName === "") statement.push("layer");
  else if (layered.layerName) statement.push(`layer(${layered.layerName})`);
  if (layered.supportsText) statement.push(`supports(${layered.supportsText})`);
  if (rule.media.length) statement.push(rule.media.mediaText);
  return `${statement.join(" ")};`;
}

function isImportRule(rule: CSSRule): rule is CSSImportRule {
  return "styleSheet" in rule;
}

function isStyleRule(rule: CSSRule): rule is CSSStyleRule {
  return "selectorText" in rule;
}

function stringifyRule(rule: CSSRule, sheetHref: string | null): string {
  if (isImportRule(rule)) {
    const imported = rule.styleSheet as CSSStyleSheet;
    let text: string;
    try {
      text = stringifyStylesheet(imported) || escapeImportStatement(rule);
    } catch {
      text = rule.cssText;
    }
    return imported.href ? absolutifyURLs(text, imported.href) : text;
  }
  let text = rule.cssText;
  if (isStyleRule(rule) && rule.selectorText.includes(":")) {
    text = text.replace(SAFARI_COLONS, "$1\\$2");
  }
  return sheetHref ? absolutifyURLs(text, sheetHref) : text;
}

export function stringifyStylesheet(sheet: CSSStyleSheet): string | null {
  try {
    const rules = sheet.cssRules;
    if (!rules) return null;
    let sheetHref = sheet.href;
    if (!sheetHref && sheet.ownerNode) sheetHref = sheet.ownerNode.baseURI;
    const text = Array.from(rules, (rule) => stringifyRule(rule, sheetHref)).join("");
    return fixBrowserCompatibilityIssuesInCSS(text);
  } catch {
    return null;
  }
}

function normalizeCssString(cssText: string): string {
  return cssText.replace(CSS_NORMALIZE, "$1");
}

/** Where each of a `<style>`'s text nodes starts in its sheet's text, so a replay can edit one. */
function splitCssText(cssText: string, style: HTMLStyleElement): string[] {
  const childNodes = Array.from(style.childNodes);
  const splits: string[] = [];
  let iterCount = 0;
  if (childNodes.length > 1 && cssText) {
    let cssTextNorm = normalizeCssString(cssText);
    const normFactor = cssTextNorm.length / cssText.length;
    for (let i = 1; i < childNodes.length; i++) {
      const content = childNodes[i]?.textContent;
      if (!content) continue;
      const textContentNorm = normalizeCssString(content);
      const jLimit = 100;
      let j = 3;
      for (; j < textContentNorm.length; j++) {
        if (
          /[a-zA-Z0-9]/.test(textContentNorm[j] ?? "") ||
          textContentNorm.indexOf(textContentNorm.substring(0, j), 1) !== -1
        ) {
          continue;
        }
        break;
      }
      for (; j < textContentNorm.length; j++) {
        let startSubstring = textContentNorm.substring(0, j);
        let cssNormSplits = cssTextNorm.split(startSubstring);
        let splitNorm = -1;
        if (cssNormSplits.length === 2) {
          splitNorm = cssNormSplits[0]?.length ?? -1;
        } else if (
          cssNormSplits.length > 2 &&
          cssNormSplits[0] === "" &&
          childNodes[i - 1]?.textContent !== ""
        ) {
          splitNorm = cssTextNorm.indexOf(startSubstring, 1);
        } else if (cssNormSplits.length === 1) {
          startSubstring = startSubstring.substring(0, startSubstring.length - 1);
          cssNormSplits = cssTextNorm.split(startSubstring);
          if (cssNormSplits.length <= 1) {
            splits.push(cssText);
            return splits;
          }
          j = jLimit + 1;
        } else if (j === textContentNorm.length - 1) {
          splitNorm = cssTextNorm.indexOf(startSubstring);
        }
        if (cssNormSplits.length >= 2 && j > jLimit) {
          const prevTextContent = childNodes[i - 1]?.textContent;
          if (prevTextContent) {
            const prevMinLength = normalizeCssString(prevTextContent).length;
            splitNorm = cssTextNorm.indexOf(startSubstring, prevMinLength);
          }
          if (splitNorm === -1) splitNorm = cssNormSplits[0]?.length ?? -1;
        }
        if (splitNorm !== -1) {
          let k = Math.floor(splitNorm / normFactor);
          while (k > 0 && k < cssText.length) {
            iterCount += 1;
            if (iterCount > 50 * childNodes.length) {
              splits.push(cssText);
              return splits;
            }
            const normPart = normalizeCssString(cssText.substring(0, k));
            if (normPart.length === splitNorm) {
              splits.push(cssText.substring(0, k));
              cssText = cssText.substring(k);
              cssTextNorm = cssTextNorm.substring(splitNorm);
              break;
            } else if (normPart.length < splitNorm) {
              k += Math.max(1, Math.floor((splitNorm - normPart.length) / normFactor));
            } else {
              k -= Math.max(1, Math.floor((normPart.length - splitNorm) * normFactor));
            }
          }
          break;
        }
      }
    }
  }
  splits.push(cssText);
  return splits;
}

export function markCssSplits(cssText: string, style: HTMLStyleElement): string {
  return splitCssText(cssText, style).join("/* rr_split */");
}
