import { describe, expect, it, vi } from "vite-plus/test";
import { createConsoleTrack, type ConsoleEntry } from "./console.js";

describe("console track", () => {
  it("records output without changing what the app logs, and reports errors", () => {
    const original = console.info;
    const spy = vi.fn();
    console.info = spy;
    const onError = vi.fn();
    const pushed: ConsoleEntry[] = [];
    const track = createConsoleTrack(onError);
    track.start({
      push: (_kind, data) => pushed.push(data as ConsoleEntry),
      logger: { warn() {}, error() {} },
    });

    console.info("order", { id: 7, lines: [1, 2] });
    console.error(new Error("boom"));

    expect(spy).toHaveBeenCalledWith("order", { id: 7, lines: [1, 2] });
    expect(pushed[0]).toMatchObject({ level: "info", text: "order {id: 7, lines: [1, 2]}" });
    expect(pushed[1]).toMatchObject({ level: "error", text: "Error: boom", source: "console" });
    expect(pushed[1]!.stack).toContain("boom");
    expect(onError).toHaveBeenCalledTimes(1);

    track.stop();
    expect(console.info).toBe(spy);
    console.info = original;
  });

  it("records uncaught errors and unhandled rejections", () => {
    const pushed: ConsoleEntry[] = [];
    const track = createConsoleTrack(() => undefined);
    track.start({
      push: (_kind, data) => pushed.push(data as ConsoleEntry),
      logger: { warn() {}, error() {} },
    });

    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "x is undefined",
        error: new TypeError("x is undefined"),
      }),
    );
    const rejection = new Event("unhandledrejection") as Event & { reason: unknown };
    rejection.reason = "nope";
    window.dispatchEvent(rejection);

    expect(pushed.map((entry) => entry.source)).toEqual(["uncaught", "rejection"]);
    expect(pushed[0]!.text).toBe("Uncaught x is undefined");
    track.stop();
  });

  it("does not say Uncaught twice when the browser already did", () => {
    const pushed: ConsoleEntry[] = [];
    const track = createConsoleTrack(() => undefined);
    track.start({
      push: (_kind, data) => pushed.push(data as ConsoleEntry),
      logger: { warn() {}, error() {} },
    });
    window.dispatchEvent(
      new ErrorEvent("error", { message: "Uncaught TypeError: x is undefined" }),
    );
    expect(pushed[0]!.text).toBe("Uncaught TypeError: x is undefined");
    track.stop();
  });
});
