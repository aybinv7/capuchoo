import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { writeFileAtomic, writePrivateFile } from "./secure-file.js";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-secure-"));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("writeFileAtomic", () => {
  it("creates missing directories and writes the contents", () => {
    const file = path.join(dir, "nested", "config.json");
    writeFileAtomic(file, "{}\n");
    expect(fs.readFileSync(file, "utf8")).toBe("{}\n");
  });

  it("replaces an existing file and leaves no temporary behind", () => {
    const file = path.join(dir, "config.json");
    fs.writeFileSync(file, "old");
    writeFileAtomic(file, "new");
    expect(fs.readFileSync(file, "utf8")).toBe("new");
    expect(fs.readdirSync(dir)).toEqual(["config.json"]);
  });

  it("keeps the previous file intact when the rename fails", () => {
    const file = path.join(dir, "config.json");
    fs.writeFileSync(file, "old");
    vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw new Error("disk full");
    });

    expect(() => writeFileAtomic(file, "new")).toThrow("disk full");
    expect(fs.readFileSync(file, "utf8")).toBe("old");
    expect(fs.readdirSync(dir)).toEqual(["config.json"]);
  });
});

describe.skipIf(process.platform === "win32")("writePrivateFile", () => {
  it("creates the file readable by its owner only", () => {
    const file = path.join(dir, "credentials.json");
    writePrivateFile(file, "secret");
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it("narrows a previously world-readable file", () => {
    const file = path.join(dir, "credentials.json");
    fs.writeFileSync(file, "old", { mode: 0o644 });
    writePrivateFile(file, "secret");
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });
});
