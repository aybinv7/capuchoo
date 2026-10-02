import { describe, expect, it } from "vite-plus/test";
import type { LogLine } from "../types/job-logs.types";
import { linePieces, matchRanges, splitMatches } from "./log-pieces";
import { buildLogRows, countMatches, logText, normalizeQuery } from "./log-rows";

const E = "\u001b";
const line = (
  text: string,
  kind: LogLine["kind"] = "plain",
  time: string | null = null,
): LogLine => ({
  time,
  text,
  kind,
});

const LOG = [
  line("Run actions/checkout@v4", "group"),
  line("with: repository"),
  line("", "endgroup"),
  line("Syncing repository"),
  line("Run vp build", "group"),
  line("vp build"),
  line("built in 2s"),
];

const shape = (lines: readonly LogLine[], toggled: number[] = [], needle = "") =>
  buildLogRows({ lines, toggled: new Set(toggled), needle }).rows.map((row) => [
    row.number,
    row.kind,
    row.nested,
    row.kind === "group" ? row.open : undefined,
  ]);

describe("buildLogRows", () => {
  it("closes groups whose end the log marks, and numbers lines without the markers", () => {
    expect(shape(LOG)).toEqual([
      [1, "group", false, false],
      [3, "line", false, undefined],
      [4, "group", false, false],
    ]);
  });

  it("opens a group the reader toggles", () => {
    expect(shape(LOG, [1])).toEqual([
      [1, "group", false, true],
      [2, "line", true, undefined],
      [3, "line", false, undefined],
      [4, "group", false, false],
    ]);
  });

  it("keeps groups open when the log does not say where they end", () => {
    const unmarked = LOG.filter((entry) => entry.kind !== "endgroup");
    const result = buildLogRows({ lines: unmarked, toggled: new Set(), needle: "" });
    expect(result.groupsOpenByDefault).toBe(true);
    expect(result.rows.every((row) => row.kind === "line" || row.open)).toBe(true);
    expect(result.rows).toHaveLength(6);
    expect(shape(unmarked, [1])[0]).toEqual([1, "group", false, false]);
  });

  it("opens a group holding a search match and counts every match", () => {
    const result = buildLogRows({ lines: LOG, toggled: new Set(), needle: "built" });
    expect(result.matches).toBe(1);
    const built = result.rows.find((row) => row.line.text === "built in 2s");
    expect(built).toMatchObject({ match: true, nested: true });
  });

  it("searches the text without its colour codes", () => {
    const coloured = [line(`${E}[31mERR${E}[0m!`)];
    expect(countMatches(coloured, normalizeQuery(" err! "))).toBe(1);
    expect(countMatches(coloured, normalizeQuery("[31m"))).toBe(0);
    expect(countMatches(coloured, "")).toBe(0);
  });
});

describe("search highlighting", () => {
  it("finds every non-overlapping occurrence, case-insensitively", () => {
    expect(matchRanges("aAaa", "aa")).toEqual([
      [0, 2],
      [2, 4],
    ]);
    expect(matchRanges("abc", "")).toEqual([]);
  });

  it("marks a match spanning two colours without losing either colour", () => {
    const pieces = linePieces(line(`${E}[31mfoo${E}[32mbar${E}[0m`), "ob");
    expect(pieces.map((piece) => [piece.text, piece.class, piece.match])).toEqual([
      ["fo", "ansi-fg-1", false],
      ["o", "ansi-fg-1", true],
      ["b", "ansi-fg-2", true],
      ["ar", "ansi-fg-2", false],
    ]);
  });

  it("leaves segments alone when nothing matches", () => {
    const segments = [{ text: "plain", style: null }];
    expect(splitMatches(segments, "zzz")).toEqual([{ text: "plain", style: null, match: false }]);
  });
});

describe("logText", () => {
  it("copies plain text, with times when they are shown", () => {
    const lines = [
      line(`${E}[1mhello${E}[0m`, "plain", "2026-09-01T10:00:00Z"),
      line("", "endgroup"),
      line("world"),
    ];
    expect(logText(lines, false)).toBe("hello\nworld");
    expect(logText(lines, true)).toMatch(/^\d{2}:\d{2}:\d{2} hello\nworld$/);
  });
});
