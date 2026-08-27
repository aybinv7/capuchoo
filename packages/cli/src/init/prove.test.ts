import { describe, expect, it } from "vite-plus/test";
import { hasLanded, summariseAdoption, waitForAdoption, type UpdateLogRow } from "./prove.js";

const row = (over: Partial<UpdateLogRow> = {}): UpdateLogRow => ({
  action: "get",
  new_version: "1.0.1",
  device_id: "device-a",
  created_at: "2026-08-27T10:00:00Z",
  ...over,
});

describe("summariseAdoption", () => {
  it("counts a device that took the version", () => {
    expect(summariseAdoption([row()], "1.0.1")).toEqual({
      devices: 1,
      firstAt: "2026-08-27T10:00:00Z",
    });
  });

  /**
   * One install re-checking is one device. Counting rows would let a single
   * phone in a polling loop look like a rollout, which is exactly the kind of
   * number that gets believed.
   */
  it("counts devices, not rows", () => {
    const logs = [
      row({ created_at: "2026-08-27T10:00:00Z" }),
      row({ created_at: "2026-08-27T10:01:00Z" }),
      row({ device_id: "device-b", created_at: "2026-08-27T10:02:00Z" }),
    ];

    expect(summariseAdoption(logs, "1.0.1").devices).toBe(2);
  });

  it("reports the earliest delivery, whatever order the rows arrive in", () => {
    const logs = [
      row({ created_at: "2026-08-27T12:00:00Z" }),
      row({ device_id: "device-b", created_at: "2026-08-27T09:00:00Z" }),
    ];

    expect(summariseAdoption(logs, "1.0.1").firstAt).toBe("2026-08-27T09:00:00Z");
  });

  it("ignores other versions", () => {
    expect(summariseAdoption([row({ new_version: "1.0.0" })], "1.0.1").devices).toBe(0);
  });

  it("ignores rows that are not a delivery", () => {
    // `fail` and `rollback` name this version too, and neither is evidence that
    // a device received it.
    expect(summariseAdoption([row({ action: "fail" })], "1.0.1").devices).toBe(0);
    expect(summariseAdoption([row({ action: "rollback" })], "1.0.1").devices).toBe(0);
  });

  it("treats a missing action as a delivery, which is the column default", () => {
    expect(hasLanded([row({ action: null })], "1.0.1")).toBe(true);
  });

  it("is empty on no logs", () => {
    expect(summariseAdoption([], "1.0.1")).toEqual({ devices: 0, firstAt: null });
    expect(hasLanded([], "1.0.1")).toBe(false);
  });
});

describe("waitForAdoption", () => {
  /** A clock and a sleep that advance without real time passing. */
  function fakeClock(start = 0) {
    let current = start;
    return {
      now: () => current,
      sleep: async (ms: number) => {
        current += ms;
      },
    };
  }

  it("returns as soon as a device takes it", async () => {
    const clock = fakeClock();
    let calls = 0;

    const result = await waitForAdoption(
      async () => {
        calls += 1;
        return calls >= 3 ? [row()] : [];
      },
      "1.0.1",
      { timeoutMs: 60_000, pollMs: 1_000, ...clock },
    );

    expect(result.adopted).toBe(true);
    expect(result.adoption.devices).toBe(1);
    expect(calls).toBe(3);
  });

  it("gives up when the budget runs out", async () => {
    const clock = fakeClock();

    const result = await waitForAdoption(async () => [], "1.0.1", {
      timeoutMs: 5_000,
      pollMs: 1_000,
      ...clock,
    });

    expect(result.adopted).toBe(false);
    expect(result.adoption.devices).toBe(0);
  });

  it("never sleeps past the budget", async () => {
    const clock = fakeClock();

    await waitForAdoption(async () => [], "1.0.1", {
      timeoutMs: 5_000,
      pollMs: 2_000,
      ...clock,
    });

    // The last poll must not push the clock beyond the timeout the caller set.
    expect(clock.now()).toBeLessThanOrEqual(5_000);
  });

  /**
   * The backend sleeps when idle and answers 502 while waking. One bad response
   * must not end a wait whose whole point is patience.
   */
  it("survives a failing request and keeps waiting", async () => {
    const clock = fakeClock();
    let calls = 0;

    const result = await waitForAdoption(
      async () => {
        calls += 1;
        if (calls === 1) throw new Error("502");
        return [row()];
      },
      "1.0.1",
      { timeoutMs: 60_000, pollMs: 1_000, ...clock },
    );

    expect(result.adopted).toBe(true);
    expect(calls).toBe(2);
  });

  it("reports progress on every attempt", async () => {
    const clock = fakeClock();
    const elapsed: number[] = [];

    await waitForAdoption(async () => [], "1.0.1", {
      timeoutMs: 3_000,
      pollMs: 1_000,
      onAttempt: (ms) => elapsed.push(ms),
      ...clock,
    });

    // Including one at the deadline itself: the budget bounds how long to wait,
    // and the moment it expires is still worth a final look rather than
    // stopping a poll early and reporting nothing arrived.
    expect(elapsed).toEqual([0, 1_000, 2_000, 3_000]);
  });

  it("asks at least once even with no budget", async () => {
    const clock = fakeClock();
    let calls = 0;

    await waitForAdoption(
      async () => {
        calls += 1;
        return [];
      },
      "1.0.1",
      { timeoutMs: 0, pollMs: 1_000, ...clock },
    );

    expect(calls).toBe(1);
  });
});
