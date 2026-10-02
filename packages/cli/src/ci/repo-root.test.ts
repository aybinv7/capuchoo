import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { findRepoRoot, relativeAppDir } from "./repo-root.js";

describe("findRepoRoot", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-root-")));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("walks up to the directory holding .git", () => {
    fs.mkdirSync(path.join(dir, ".git"));
    fs.mkdirSync(path.join(dir, "apps", "shop"), { recursive: true });
    expect(findRepoRoot(path.join(dir, "apps", "shop"))).toBe(dir);
    expect(findRepoRoot(dir)).toBe(dir);
  });

  it("accepts a worktree's .git file", () => {
    fs.writeFileSync(path.join(dir, ".git"), "gitdir: elsewhere\n");
    fs.mkdirSync(path.join(dir, "app"));
    expect(findRepoRoot(path.join(dir, "app"))).toBe(dir);
  });
});

describe("relativeAppDir", () => {
  const root = path.resolve("/repo");

  it("is . at the root and forward-slashed below it", () => {
    expect(relativeAppDir(root, root)).toBe(".");
    expect(relativeAppDir(root, path.join(root, "apps", "shop"))).toBe("apps/shop");
  });

  it("is null outside the root", () => {
    expect(relativeAppDir(root, path.resolve("/elsewhere"))).toBeNull();
    expect(relativeAppDir(path.join(root, "apps"), root)).toBeNull();
  });

  it("keeps a sibling whose name starts with dots inside", () => {
    expect(relativeAppDir(root, path.join(root, "..shop"))).toBe("..shop");
  });
});
