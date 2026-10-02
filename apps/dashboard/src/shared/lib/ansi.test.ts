import { describe, expect, it } from "vite-plus/test";
import { ansiPresentation, paletteRgb, parseAnsi, stripAnsi } from "./ansi";

const E = "\u001b";

describe("parseAnsi", () => {
  it("returns plain text as one unstyled segment", () => {
    expect(parseAnsi("hello world")).toEqual([{ text: "hello world", style: null }]);
    expect(parseAnsi("")).toEqual([]);
  });

  it("splits runs on colour changes and resets", () => {
    const segments = parseAnsi(`ok ${E}[1;31mfailed${E}[0m done`);
    expect(segments.map((segment) => segment.text)).toEqual(["ok ", "failed", " done"]);
    expect(segments[1]?.style).toMatchObject({ bold: true, fg: { palette: 1 } });
    expect(segments[2]?.style).toBeNull();
  });

  it("reads bright, 256-colour and 24-bit colours", () => {
    expect(parseAnsi(`${E}[92mx`)[0]?.style?.fg).toEqual({ palette: 10 });
    expect(parseAnsi(`${E}[104mx`)[0]?.style?.bg).toEqual({ palette: 12 });
    expect(parseAnsi(`${E}[38;5;208mx`)[0]?.style?.fg).toEqual({ palette: 208 });
    expect(parseAnsi(`${E}[48;2;10;20;30mx`)[0]?.style?.bg).toEqual({ rgb: [10, 20, 30] });
    expect(parseAnsi(`${E}[38:2::1:2:3mx`)[0]?.style?.fg).toEqual({ rgb: [1, 2, 3] });
    expect(parseAnsi(`${E}[38;5;1;1mx`)[0]?.style).toMatchObject({
      fg: { palette: 1 },
      bold: true,
    });
  });

  it("turns attributes off one by one", () => {
    const [, second] = parseAnsi(`${E}[1;3;4mA${E}[22;23;24mB`);
    expect(second?.style).toBeNull();
    expect(parseAnsi(`${E}[31mA${E}[39mB`)[1]).toEqual({ text: "B", style: null });
  });

  it("keeps only what follows a bare carriage return, like a terminal", () => {
    expect(stripAnsi("progress 10%\rprogress 100%")).toBe("progress 100%");
    expect(stripAnsi("line\r")).toBe("line");
  });

  it("drops cursor movement, OSC payloads and control characters", () => {
    expect(stripAnsi(`${E}[2K${E}[1Aa${E}[?25lb\u0007c\u0000d`)).toBe("abcd");
    expect(stripAnsi(`${E}]0;title${E}\\text`)).toBe("text");
    expect(stripAnsi("tab\tkept")).toBe("tab\tkept");
    expect(stripAnsi(`cut ${E}[31`)).toBe("cut ");
  });
});

describe("parseAnsi against hostile input", () => {
  it("passes markup through as text, never as structure", () => {
    const html = `<img src=x onerror="alert(1)"><script>alert(2)</script>`;
    const segments = parseAnsi(`${E}[31m${html}${E}[0m`);
    expect(segments).toEqual([{ text: html, style: expect.any(Object) }]);
    expect(ansiPresentation(segments[0]!.style).class).toBe("ansi-fg-1");
  });

  it("keeps a hyperlink's text and drops its target", () => {
    const link = `${E}]8;;javascript:alert(1)\u0007click${E}]8;;\u0007`;
    expect(parseAnsi(link)).toEqual([{ text: "click", style: null }]);
  });

  it("ignores out-of-range and malformed colour parameters", () => {
    expect(parseAnsi(`${E}[38;2;999;0;0mx`)[0]?.style).toBeNull();
    expect(parseAnsi(`${E}[38;5;300mx`)[0]?.style).toBeNull();
    expect(parseAnsi(`${E}[38;5;-1mx`)).toEqual([{ text: "1mx", style: null }]);
  });

  it("cannot smuggle CSS through a colour sequence", () => {
    const attack = `${E}[38;2;1;2;3);background:url(//evil)mtext`;
    const segments = parseAnsi(attack);
    for (const segment of segments) {
      const { style } = ansiPresentation(segment.style);
      for (const value of Object.values(style ?? {})) expect(value).not.toMatch(/url|;|\)\s*\w/);
    }
    expect(segments.map((segment) => segment.text).join("")).toContain("text");
  });

  it("only ever emits rgb() values built from numbers", () => {
    const inputs = [`${E}[38;2;255;128;0mx`, `${E}[48;5;196mx`, `${E}[38;5;244;7mx`];
    for (const input of inputs) {
      const { style } = ansiPresentation(parseAnsi(input)[0]!.style);
      for (const value of Object.values(style ?? {}))
        expect(value).toMatch(/^rgb\(\d{1,3} \d{1,3} \d{1,3}\)$/);
    }
  });

  it("stays linear on a long run of escapes", () => {
    const noisy = `${E}[31m${"a".repeat(10)}`.repeat(20_000);
    const started = performance.now();
    expect(stripAnsi(noisy)).toHaveLength(200_000);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe("ansiPresentation", () => {
  it("uses theme classes for named colours and inline values for the rest", () => {
    const [segment] = parseAnsi(`${E}[1;4;9;33;48;5;21mx`);
    expect(ansiPresentation(segment!.style)).toEqual({
      class: "ansi-fg-3 font-semibold",
      style: { backgroundColor: "rgb(0 0 255)", textDecorationLine: "underline line-through" },
    });
  });

  it("swaps colours for inverse video, falling back to the theme's pair", () => {
    expect(ansiPresentation(parseAnsi(`${E}[7mx`)[0]!.style).class).toBe(
      "ansi-fg-inverse ansi-bg-inverse",
    );
    expect(ansiPresentation(parseAnsi(`${E}[7;31mx`)[0]!.style).class).toBe(
      "ansi-fg-inverse ansi-bg-1",
    );
  });

  it("maps the xterm cube and grey ramp", () => {
    expect(paletteRgb(16)).toEqual([0, 0, 0]);
    expect(paletteRgb(231)).toEqual([255, 255, 255]);
    expect(paletteRgb(232)).toEqual([8, 8, 8]);
  });
});
