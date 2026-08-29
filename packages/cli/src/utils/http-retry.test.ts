import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { get, post, TimeoutError } from "./http.js";

/**
 * The backend sleeps when idle, and a cold start was measured at 32.2s against
 * a 30s timeout. So the first command of a session failed and the second
 * succeeded - the worst possible shape, because the tool looks broken and then
 * looks fine. It happened five times in one working session, in init, doctor
 * and deploy, and every time the fix was to run `curl /api/health` first, which
 * no user would think to do.
 */
const OPTIONS = { endpoint: "https://backend.test", apiKey: "k" };

/** An AbortError is what fetch raises when the request's signal fires. */
function abortError(): Error {
  const error = new Error("This operation was aborted");
  error.name = "AbortError";
  return error;
}

let calls: Array<{ method: string; url: string }>;

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Fails the first `failures` calls with an abort, then answers. */
function flakyFetch(failures: number, body: unknown = { ok: true }) {
  return vi.fn(async (url: string, init: { method: string }) => {
    calls.push({ method: init.method, url: String(url) });

    if (calls.length <= failures) throw abortError();

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  });
}

describe("a timed-out GET is retried once", () => {
  it("succeeds on the second attempt", async () => {
    vi.stubGlobal("fetch", flakyFetch(1, { user: "me" }));

    expect(await get("/api/auth/me", OPTIONS)).toEqual({ user: "me" });
    expect(calls).toHaveLength(2);
  });

  it("says the backend is waking, rather than sitting silent", async () => {
    // Ninety seconds of no output is indistinguishable from a hang.
    vi.stubGlobal("fetch", flakyFetch(1));
    const onWaking = vi.fn();

    await get("/api/auth/me", { ...OPTIONS, onWaking });

    expect(onWaking).toHaveBeenCalledTimes(1);
  });

  it("gives up after the second attempt rather than looping", async () => {
    vi.stubGlobal("fetch", flakyFetch(99));

    await expect(get("/api/auth/me", OPTIONS)).rejects.toBeInstanceOf(TimeoutError);
    expect(calls).toHaveLength(2);
  });

  it("does not announce a wake when the first attempt worked", async () => {
    vi.stubGlobal("fetch", flakyFetch(0));
    const onWaking = vi.fn();

    await get("/api/apps", { ...OPTIONS, onWaking });

    expect(onWaking).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });
});

/**
 * The line that keeps this safe. A timeout says the response never arrived, not
 * that the server did nothing - replaying an upload could publish the same
 * bundle twice, and no amount of convenience is worth that.
 */
describe("a timed-out write is not retried", () => {
  it("gives up on POST after one attempt", async () => {
    vi.stubGlobal("fetch", flakyFetch(99));

    await expect(post("/api/admin/upload", { v: 1 }, OPTIONS)).rejects.toBeInstanceOf(TimeoutError);
    expect(calls).toHaveLength(1);
  });

  it("does not announce a wake it will not act on", async () => {
    vi.stubGlobal("fetch", flakyFetch(99));
    const onWaking = vi.fn();

    await expect(post("/api/apps", { name: "x" }, { ...OPTIONS, onWaking })).rejects.toThrow();

    expect(onWaking).not.toHaveBeenCalled();
  });
});

describe("other failures are untouched", () => {
  it("does not retry a rejection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { method: string }) => {
        calls.push({ method: init.method, url: String(url) });
        return {
          ok: false,
          status: 401,
          text: async () => JSON.stringify({ error: "nope" }),
        } as unknown as Response;
      }),
    );

    // A 401 is an answer. Asking again gets the same answer more slowly.
    await expect(get("/api/auth/me", OPTIONS)).rejects.toThrow("nope");
    expect(calls).toHaveLength(1);
  });
});
