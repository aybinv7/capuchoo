import { describe, expect, it } from "vite-plus/test";
import { normalizeRequestFields } from "./fieldNormalizer";

/**
 * The middleware destroyed the batch before the controller could see it.
 *
 * `CapgoUpdater.java` posts its queued statistics as a bare JSONArray. This
 * middleware ran first, and `typeof [] === "object"` is true, so
 * `{ ...req.body }` turned the array into `{ "0": {...}, "1": {...} }`. By the
 * time the controller asked `Array.isArray(req.body)` the answer was already
 * no, `extractStatsRequest` found no device_id on an object of numeric keys,
 * and the batch was answered:
 *
 *   400 {"error":"Missing required parameters: device_id, app_id, platform"}
 *
 * 400 is fatal - `isTransientStatsFailure` retries only 408, 429 and 5xx - so
 * the plugin logged "Dropping stats batch after permanent error" and discarded
 * the events permanently.
 *
 * This was diagnosed once as a missing batch branch in the controller. That
 * branch was real, and correct, and changed nothing, because the body never
 * arrived as a batch. Two days of "the fix is deployed and the endpoint still
 * 400s" came from fixing the second half of a problem whose first half was one
 * layer up.
 */
function run(body: unknown): unknown {
  const req = { body, query: {} } as never as Parameters<typeof normalizeRequestFields>[0];
  let called = false;

  normalizeRequestFields(req, {} as never, () => {
    called = true;
  });

  expect(called, "next() was not called").toBe(true);
  return (req as { body: unknown }).body;
}

describe("a batch survives normalization", () => {
  it("stays an array", () => {
    const body = run([{ device_id: "a", app_id: "x", platform: "android" }]);

    expect(Array.isArray(body)).toBe(true);
  });

  it("is not the plain object the spread used to produce", () => {
    // `Object.keys` is no good here - a real array answers ["0","1"] too. What
    // separates the two is whether it is still an array at all, which is
    // exactly the question the controller asks.
    const body = run([{ device_id: "a" }, { device_id: "b" }]);
    const broken = { ...([{ device_id: "a" }, { device_id: "b" }] as unknown as object) };

    expect(Array.isArray(broken), "the old shape").toBe(false);
    expect(Array.isArray(body), "the new shape").toBe(true);
  });

  it("keeps every entry, in order", () => {
    const body = run([{ device_id: "a" }, { device_id: "b" }, { device_id: "c" }]) as Array<{
      device_id: string;
    }>;

    expect(body.map((entry) => entry.device_id)).toEqual(["a", "b", "c"]);
  });

  it("normalizes each entry rather than only the first", () => {
    const body = run([{ action: "set" }, { action: "get" }]) as Array<Record<string, unknown>>;

    // `status` is the legacy spelling the controller reads.
    expect(body.map((entry) => entry.status)).toEqual(["set", "get"]);
  });

  it("leaves a non-object entry alone instead of throwing", () => {
    // A malformed batch must not 500 the endpoint - it is telemetry.
    const body = run([null, "x", 3]) as unknown[];

    expect(body).toEqual([null, "x", 3]);
  });
});

describe("a single object still normalizes as before", () => {
  it("maps action to status", () => {
    const body = run({ action: "set", device_id: "a" }) as Record<string, unknown>;

    expect(body.status).toBe("set");
  });

  it("maps status to action", () => {
    const body = run({ status: "get" }) as Record<string, unknown>;

    expect(body.action).toBe("get");
  });

  it("does not turn an object into an array", () => {
    expect(Array.isArray(run({ device_id: "a" }))).toBe(false);
  });
});
