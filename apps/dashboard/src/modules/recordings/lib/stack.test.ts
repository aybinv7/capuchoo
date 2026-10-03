import { describe, expect, it } from "vite-plus/test";
import { bundlePath, parseStack } from "./stack";
import { loadTraceMapping, parseMap, resolveFrames } from "./symbolicate";

const STACK = `TypeError: Cannot read properties of undefined (reading 'lines')
    at e (https://localhost/assets/index-abc.js:1:11)
    at async https://localhost/assets/index-abc.js:1:900
r@https://localhost/assets/vendor.js:3:4
    at <anonymous>`;

const MAP = {
  version: 3,
  sources: ["../../src/orders/submit.ts", "../../node_modules/vue/index.js"],
  names: ["submitOrder"],
  mappings: "UAyCMA",
  sourcesContent: [
    Array.from({ length: 50 }, (_, index) => `line ${index + 1}`).join(String.fromCharCode(10)),
    null,
  ],
};

describe("parseStack", () => {
  it("reads V8 and Gecko frames and drops what is not a frame", () => {
    const frames = parseStack(STACK);
    expect(frames).toHaveLength(3);
    expect(frames[0]).toMatchObject({ fn: "e", line: 1, column: 11 });
    expect(frames[1]).toMatchObject({ fn: null, url: "https://localhost/assets/index-abc.js" });
    expect(frames[2]).toMatchObject({ fn: "r", url: "https://localhost/assets/vendor.js" });
  });

  it("maps a frame's script to its path in the bundle", () => {
    expect(bundlePath("https://localhost/assets/index-abc.js")).toBe("assets/index-abc.js");
    expect(bundlePath("https://localhost/")).toBeNull();
    expect(bundlePath("not a url")).toBeNull();
  });
});

describe("resolveFrames", () => {
  it("puts a frame back in the app's sources when its map is there", async () => {
    const mapping = await loadTraceMapping();
    const map = parseMap(mapping, MAP);
    const frames = resolveFrames(mapping, parseStack(STACK), (path) =>
      path === "assets/index-abc.js.map" ? map : null,
    );
    expect(frames[0]!.original).toEqual({
      source: "src/orders/submit.ts",
      line: 42,
      column: 7,
      name: "submitOrder",
      context: {
        start: 39,
        lines: ["line 39", "line 40", "line 41", "line 42", "line 43", "line 44", "line 45"],
      },
    });
    expect(frames[0]!.library).toBe(false);
    expect(frames[2]!.original).toBeNull();
  });
});
