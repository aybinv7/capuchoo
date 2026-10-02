import { describe, expect, it } from "vite-plus/test";
import { parseOriginHead } from "./default-branch.js";

describe("parseOriginHead", () => {
  it("reads the branch origin/HEAD points at", () => {
    expect(parseOriginHead("refs/remotes/origin/main\n")).toBe("main");
    expect(parseOriginHead("refs/remotes/origin/release/2.x")).toBe("release/2.x");
  });

  it("is null for anything else", () => {
    expect(parseOriginHead("")).toBeNull();
    expect(parseOriginHead("refs/remotes/origin/")).toBeNull();
    expect(parseOriginHead("refs/heads/main")).toBeNull();
  });
});
