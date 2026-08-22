import { describe, expect, it } from "vite-plus/test";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Acme Corp")).toBe("acme-corp");
    expect(slugify("  Spaced   Out  ")).toBe("spaced-out");
  });

  it("strips accents rather than the letters carrying them", () => {
    expect(slugify("Café Zürich")).toBe("cafe-zurich");
  });

  it("collapses punctuation and never leads or trails with a hyphen", () => {
    expect(slugify("Foo & Bar, Inc.")).toBe("foo-bar-inc");
    expect(slugify("!!!weird!!!")).toBe("weird");
  });

  it("returns empty when there is nothing usable, so the caller can fall back", () => {
    expect(slugify("！！！")).toBe("");
    expect(slugify("")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("uses the plain slug when it is free", async () => {
    expect(await uniqueSlug("Acme Corp", async () => false)).toBe("acme-corp");
  });

  it("suffixes until it finds a free one", async () => {
    const used = new Set(["acme", "acme-2", "acme-3"]);
    expect(await uniqueSlug("Acme", async (c) => used.has(c))).toBe("acme-4");
  });

  it("falls back when the name yields nothing sluggable", async () => {
    expect(await uniqueSlug("！！！", async () => false, "org")).toBe("org");
  });

  it("gives up rather than looping forever", async () => {
    await expect(uniqueSlug("Acme", async () => true)).rejects.toThrow(
      /Could not find a free slug/,
    );
  });
});
