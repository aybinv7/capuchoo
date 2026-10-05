import { describe, expect, it } from "vite-plus/test";
import type { SearchItem } from "../types";
import { matchScore, parseQuery, rankItems, scoreItem } from "./rank";

const item = (label: string, extra: Partial<SearchItem> = {}): SearchItem => ({
  id: label,
  scope: "pages",
  label,
  ...extra,
});

describe("query parsing", () => {
  it("reads a scope prefix and lowercases the term", () => {
    expect(parseQuery("#Prod ")).toEqual({ scope: "channels", term: "prod" });
    expect(parseQuery("> theme")).toEqual({ scope: "actions", term: "theme" });
    expect(parseQuery("@")).toEqual({ scope: "devices", term: "" });
  });

  it("leaves plain queries unscoped", () => {
    expect(parseQuery("  Devices")).toEqual({ scope: null, term: "devices" });
  });
});

describe("matching", () => {
  it("prefers exact, then prefix, then word start, then substring, then letters in order", () => {
    const scores = ["prod", "production", "dev-prod", "reprod", "p-r-o-d"].map((text) =>
      matchScore("prod", text),
    );
    expect(scores).toEqual([100, 80, 60, 40, 10]);
  });

  it("does not match a single letter out of order", () => {
    expect(matchScore("z", "prod")).toBe(0);
  });

  it("needs every term to match somewhere", () => {
    const channel = item("prod-geant", { hint: "0.1.10", keywords: ["client"] });
    expect(scoreItem(channel, "geant 0.1.10")).toBeGreaterThan(0);
    expect(scoreItem(channel, "geant staging")).toBe(0);
  });
});

describe("ranking", () => {
  it("orders by score, then alphabetically, and caps the list", () => {
    const ranked = rankItems(
      [item("Channels"), item("Builds"), item("Channel settings")],
      "chan",
      2,
    );
    expect(ranked.map((entry) => entry.item.label)).toEqual(["Channel settings", "Channels"]);
  });

  it("keeps everything for an empty term", () => {
    expect(rankItems([item("b"), item("a")], "", 10).map((entry) => entry.item.label)).toEqual([
      "a",
      "b",
    ]);
  });

  it("puts the most recent first among equal matches", () => {
    const ranked = rankItems(
      [item("1.7.0", { recency: 1 }), item("1.9.1", { recency: 3 }), item("1.8.2", { recency: 2 })],
      "",
      10,
    );
    expect(ranked.map((entry) => entry.item.label)).toEqual(["1.9.1", "1.8.2", "1.7.0"]);
  });
});
