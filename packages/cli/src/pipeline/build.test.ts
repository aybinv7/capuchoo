import { describe, expect, it } from "vitest";
import { tokenize } from "./build.js";

describe("tokenize", () => {
  it("splits on whitespace", () => {
    expect(tokenize("vite build --mode staging")).toEqual([
      "vite",
      "build",
      "--mode",
      "staging",
    ]);
  });

  it("keeps a quoted path with spaces as one argument", () => {
    // This is the case that made the old shell-string approach wrong: a path
    // under "Program Files" became two arguments.
    expect(tokenize('node "C:/Program Files/tool/run.js" --flag')).toEqual([
      "node",
      "C:/Program Files/tool/run.js",
      "--flag",
    ]);
  });

  it("handles single quotes", () => {
    expect(tokenize("echo 'hello world'")).toEqual(["echo", "hello world"]);
  });

  it("collapses repeated whitespace", () => {
    expect(tokenize("  vite   build  ")).toEqual(["vite", "build"]);
  });

  it("rejects an unbalanced quote instead of silently truncating", () => {
    expect(() => tokenize('node "unterminated')).toThrow(/Unbalanced/);
  });

  it("returns an empty list for an empty command", () => {
    expect(tokenize("   ")).toEqual([]);
  });
});
