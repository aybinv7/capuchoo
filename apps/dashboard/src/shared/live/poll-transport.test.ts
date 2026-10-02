import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const get = vi.hoisted(() => vi.fn());
vi.mock("../api/http", () => ({ http: { get } }));

const { openPollTransport } = await import("./poll-transport");

function handlers() {
  return { ready: vi.fn(), event: vi.fn(), alive: vi.fn(), failed: vi.fn() };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  get.mockReset();
});

describe("openPollTransport", () => {
  it("handshakes for a cursor, then delivers events and advances it", async () => {
    let call = 0;
    get.mockImplementation(async (_path: string, query: Record<string, unknown>) => {
      call += 1;
      if (call === 1) return { cursor: "10", reset: false, events: [] };
      if (call === 2) {
        expect(query).toEqual({ after: "10", wait: 25 });
        return { cursor: "12", reset: false, events: [{ type: "build", data: { id: "b" } }] };
      }
      return new Promise(() => undefined);
    });
    const cursor = { value: null as string | null };
    const on = handlers();
    const transport = openPollTransport("app-1", cursor, on);
    await flush();
    await flush();
    expect(on.ready).toHaveBeenCalledWith(false);
    expect(on.event).toHaveBeenCalledWith("build", { id: "b" });
    expect(cursor.value).toBe("12");
    transport.close();
  });

  it("resumes from a kept cursor and reports lost events only on reset", async () => {
    get.mockResolvedValueOnce({ cursor: "20", reset: true, events: [] });
    get.mockImplementation(() => new Promise(() => undefined));
    const on = handlers();
    const transport = openPollTransport("app-1", { value: "5" }, on);
    await flush();
    expect(get.mock.calls[0]![1]).toEqual({ after: "5", wait: 0 });
    expect(on.ready).toHaveBeenCalledWith(true);
    transport.close();
  });

  it("reports a failure, but not after being closed", async () => {
    get.mockRejectedValueOnce(new Error("offline"));
    const on = handlers();
    openPollTransport("app-1", { value: null }, on);
    await flush();
    expect(on.failed).toHaveBeenCalledTimes(1);

    let reject: (error: Error) => void = () => undefined;
    get.mockImplementationOnce(() => new Promise((_, fail) => (reject = fail)));
    const quiet = handlers();
    const transport = openPollTransport("app-1", { value: null }, quiet);
    transport.close();
    reject(new Error("aborted"));
    await flush();
    expect(quiet.failed).not.toHaveBeenCalled();
  });
});
