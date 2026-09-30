import { describe, expect, it } from "vite-plus/test";
import { gitignoreCovers, ignorePatch } from "./gitignore.js";

const KEY = ".capuchoo/signing-key.pem";

describe("gitignoreCovers", () => {
  it.each([
    ".capuchoo/signing-key.pem",
    "/.capuchoo/signing-key.pem",
    "signing-key.pem",
    "*.pem",
    ".capuchoo/",
  ])("recognises %s", (line) => {
    expect(gitignoreCovers(`node_modules\n${line}\n`, KEY)).toBe(true);
  });

  it("ignores comments and honours a later negation", () => {
    expect(gitignoreCovers(`# ${KEY}\n`, KEY)).toBe(false);
    expect(gitignoreCovers(`*.pem\n!*.pem\n`, KEY)).toBe(false);
  });

  it("does not treat unrelated entries as cover", () => {
    expect(gitignoreCovers("dist\n.env\n", KEY)).toBe(false);
  });
});

describe("ignorePatch", () => {
  it("appends the key path, adding a newline when the file lacks one", () => {
    expect(ignorePatch("dist", KEY)).toBe(`dist\n${KEY}\n`);
    expect(ignorePatch("dist\n", KEY)).toBe(`dist\n${KEY}\n`);
  });

  it("creates the file content when there is none", () => {
    expect(ignorePatch(null, KEY)).toBe(`${KEY}\n`);
  });

  it("changes nothing when already covered", () => {
    expect(ignorePatch("*.pem\n", KEY)).toBeNull();
  });
});
