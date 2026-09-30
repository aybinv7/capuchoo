import type { RankedItem, SearchItem, SearchScope } from "../types";

/** Typed before a query, these narrow the palette to one kind of result. */
export const SCOPE_PREFIXES: Readonly<Record<string, SearchScope>> = {
  ">": "actions",
  "#": "channels",
  "@": "devices",
  "/": "pages",
};

export interface ParsedQuery {
  scope: SearchScope | null;
  term: string;
}

export function parseQuery(raw: string): ParsedQuery {
  const trimmed = raw.trimStart();
  const scope = SCOPE_PREFIXES[trimmed.charAt(0)];
  return scope
    ? { scope, term: trimmed.slice(1).trim().toLowerCase() }
    : { scope: null, term: trimmed.trim().toLowerCase() };
}

function subsequence(term: string, text: string): boolean {
  let index = 0;
  for (const char of text) if (char === term[index] && ++index === term.length) return true;
  return false;
}

/**
 * How well one piece of text answers a term: exact, prefix, word start, substring, then letters
 * in order. Zero means no match.
 */
export function matchScore(term: string, text: string): number {
  const value = text.toLowerCase();
  if (!term) return 1;
  if (value === term) return 100;
  if (value.startsWith(term)) return 80;
  const at = value.indexOf(term);
  if (at > 0 && /[\s._/:@-]/.test(value.charAt(at - 1))) return 60;
  if (at >= 0) return 40;
  return term.length > 1 && subsequence(term, value) ? 10 : 0;
}

/** Every term of the query must match the label or a keyword; the label counts double. */
export function scoreItem(item: SearchItem, term: string): number {
  const terms = term.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;
  let total = 0;
  for (const part of terms) {
    const label = matchScore(part, item.label) * 2;
    let best = label;
    for (const text of [item.hint ?? "", ...(item.keywords ?? [])])
      best = Math.max(best, matchScore(part, text));
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

export function rankItems(items: readonly SearchItem[], term: string, limit: number): RankedItem[] {
  const ranked: RankedItem[] = [];
  for (const item of items) {
    const score = scoreItem(item, term);
    if (score > 0) ranked.push({ item, score });
  }
  ranked.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));
  return ranked.slice(0, limit);
}
