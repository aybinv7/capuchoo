import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { androidWebAssets, findSourceMaps, stripSourceMaps } from "./source-maps.js";

let root: string;

function write(relative: string): void {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "{}");
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-maps-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("source maps in a native build", () => {
  it("finds the build's maps with bundle paths, and strips only Capacitor's copy", () => {
    write("dist/assets/index.js.map");
    write("dist/assets/nested/view.js.map");
    write("dist/assets/index.js");
    const copy = androidWebAssets(path.join(root, "android"));
    for (const name of ["assets/index.js.map", "assets/index.js", "index.html"]) {
      write(path.relative(root, path.join(copy, name)));
    }

    expect(findSourceMaps(path.join(root, "dist")).map((map) => map.path)).toEqual([
      "assets/index.js.map",
      "assets/nested/view.js.map",
    ]);
    expect(stripSourceMaps(copy)).toBe(1);
    expect(fs.existsSync(path.join(copy, "assets/index.js.map"))).toBe(false);
    expect(fs.existsSync(path.join(copy, "assets/index.js"))).toBe(true);
    expect(fs.existsSync(path.join(root, "dist/assets/index.js.map"))).toBe(true);
    expect(stripSourceMaps(path.join(root, "missing"))).toBe(0);
  });
});
