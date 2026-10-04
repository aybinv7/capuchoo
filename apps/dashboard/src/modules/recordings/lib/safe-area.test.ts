import { describe, expect, it } from "vite-plus/test";
import { withSafeArea } from "./safe-area";

const phone = { top: 36.4, right: 0, bottom: 24, left: 0 };

describe("safe area", () => {
  it("gives the replay the insets the phone had", () => {
    expect(withSafeArea(":root{--f7-safe-area-top:env(safe-area-inset-top)}", phone)).toBe(
      ":root{--f7-safe-area-top:36.4px}",
    );
    expect(withSafeArea("padding-bottom: env( safe-area-inset-bottom , 12px)", phone)).toBe(
      "padding-bottom: 24px",
    );
  });

  it("replaces a fallback that has parentheses of its own, and the old constant()", () => {
    expect(
      withSafeArea(
        "top: env(safe-area-inset-top, calc(4px + 2px)); left: constant(safe-area-inset-left)",
        phone,
      ),
    ).toBe("top: 36.4px; left: 0px");
  });

  it("leaves CSS alone when it has no insets, or nothing is known", () => {
    const css = ".a{padding:max(8px, env(safe-area-inset-top))}";
    expect(withSafeArea(css, null)).toBe(css);
    expect(withSafeArea(".b{color:red}", phone)).toBe(".b{color:red}");
    expect(withSafeArea(css, phone)).toBe(".a{padding:max(8px, 36.4px)}");
  });
});

describe("safe area in a recorded page", () => {
  it("reaches inline <style> text, style attributes and stylesheet rules", async () => {
    const { rewriteReplayEvent } = await import("./asset-rewrite");
    const snapshot = {
      type: 2,
      data: {
        node: {
          type: 0,
          childNodes: [
            {
              type: 2,
              tagName: "style",
              childNodes: [{ type: 3, textContent: ".nav{top:env(safe-area-inset-top)}" }],
            },
            {
              type: 2,
              tagName: "div",
              attributes: { style: "padding-top: env(safe-area-inset-top)" },
            },
          ],
        },
      },
    };
    rewriteReplayEvent(snapshot, new Map(), phone);
    expect(JSON.stringify(snapshot)).not.toContain("env(");
    expect(JSON.stringify(snapshot)).toContain("top:36.4px");

    const rule = {
      type: 3,
      data: { source: 8, adds: [{ rule: ".x{bottom:env(safe-area-inset-bottom)}" }] },
    };
    rewriteReplayEvent(rule, new Map(), phone);
    expect(rule.data.adds[0]!.rule).toBe(".x{bottom:24px}");
  });
});
