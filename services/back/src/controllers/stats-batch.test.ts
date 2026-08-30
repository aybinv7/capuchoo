import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";

/**
 * The plugin batches its statistics, and every batch was thrown away.
 *
 * `CapgoUpdater.java` builds a `JSONArray` of queued events and posts that, so
 * the body is a bare array. This handler read `req.body.device_id` off it, found
 * nothing, and answered 400.
 *
 * 400 is fatal there. `isTransientStatsFailure` retries only 408, 429 and 5xx:
 *
 *   private static boolean isTransientStatsFailure(final int statusCode) {
 *       return statusCode == 429 || statusCode == 408 || statusCode >= 500;
 *   }
 *
 * so anything else drops the batch and never sends it again -
 * "Dropping stats batch after permanent error", seen in a real device console.
 * Every statistic the plugin ever produced was discarded on arrival.
 *
 * Reproduced against the deployed backend before the fix:
 *
 *   POST /api/stats  [{...}, {...}]
 *   400  {"error":"Missing required parameters: device_id, app_id, platform"}
 */
const source = fs.readFileSync(path.join(import.meta.dirname, "statsController.ts"), "utf8");

describe("the stats endpoint accepts what the plugin sends", () => {
  it("handles a bare array", () => {
    expect(source).toContain("Array.isArray(req.body)");
    expect(source).toContain("logBatch");
  });

  it("checks for the array before reading fields off the body", () => {
    // Reading first is the bug: every field on an array is undefined, and the
    // validation below then rejects a batch that was perfectly well formed.
    const arrayCheck = source.indexOf("Array.isArray(req.body)");
    const extract = source.indexOf("extractStatsRequest(req.body)");

    expect(arrayCheck).toBeGreaterThan(-1);
    expect(arrayCheck).toBeLessThan(extract);
  });

  /**
   * One bad row must not cost the good ones. The plugin cannot resend a subset,
   * so a 400 for a single malformed event would permanently discard every valid
   * event beside it.
   */
  it("does not fail a batch for one bad event", () => {
    expect(source).toContain("problems.push");
    expect(source).toContain("stored += 1");
  });

  it("only refuses a batch where nothing at all could be stored", () => {
    expect(source).toContain("stored === 0 && events.length > 0");
  });

  it("reports how many landed, so a partial batch is visible", () => {
    expect(source).toContain("stored, received: events.length");
  });
});
