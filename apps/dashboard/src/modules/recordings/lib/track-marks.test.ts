import { describe, expect, it } from "vite-plus/test";
import { marksNear, trackMarks } from "./track-marks";

const bounds = { start: 1000, end: 11_000 };

describe("track marks", () => {
  it("puts issues and the recording's own markers on the rail, in order, without routes", () => {
    const marks = trackMarks(
      [
        { t: 6000, kind: "error", label: "TypeError: x is undefined\n    at f (app.js:1)" },
        { t: 3000, kind: "request", label: "GET /api → 500" },
      ],
      [
        { id: "m1", at: 0.1, kind: "trigger", label: "Started by policy" },
        { id: "m2", at: 0.2, kind: "route", label: "Navigated to /" },
      ],
      bounds,
    );
    expect(marks.map((mark) => [mark.at, mark.tone, mark.label])).toEqual([
      [0.1, "primary", "Started by policy"],
      [0.2, "danger", "GET /api → 500"],
      [0.5, "danger", "TypeError: x is undefined"],
    ]);
  });

  it("draws a report once, as its trigger", () => {
    const marks = trackMarks(
      [{ t: 2000, kind: "report", label: "Shake report" }],
      [{ id: "m1", at: 0.1, kind: "trigger", label: "Shake report" }],
      bounds,
    );
    expect(marks).toHaveLength(1);
  });

  it("finds the marks under the pointer, nearest first", () => {
    const marks = trackMarks(
      [
        { t: 6000, kind: "error", label: "A" },
        { t: 6100, kind: "error", label: "B" },
        { t: 9000, kind: "error", label: "C" },
      ],
      [],
      bounds,
    );
    expect(marksNear(marks, 0.507, 0.01).map((mark) => mark.label)).toEqual(["B", "A"]);
    expect(marksNear(marks, 0.7, 0.01)).toEqual([]);
  });
});
