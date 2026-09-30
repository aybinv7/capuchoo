import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

type ChunkCallback = (chunk: { data: string } | null, error?: unknown) => void;
type Range = { offset: number; length: number };

const mocks = vi.hoisted(() => ({
  readFileInChunks:
    vi.fn<(options: { chunkSize: number }, callback: ChunkCallback) => Promise<string>>(),
  readFile: vi.fn<(options: Range) => Promise<{ data: string }>>(),
}));

vi.mock("./optional-plugins.js", () => ({
  nativePlugins: {
    filesystem: async () => ({
      Directory: { Cache: "CACHE" },
      Filesystem: { readFileInChunks: mocks.readFileInChunks, readFile: mocks.readFile },
    }),
  },
}));

const { hashCachedFile } = await import("./apk-hash.js");

const file = randomBytes(1_300_000);
const expected = createHash("sha256").update(file).digest("hex");
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

beforeEach(() => {
  mocks.readFileInChunks.mockReset();
  mocks.readFile.mockReset();
});

describe("hashCachedFile", () => {
  it("hashes readFileInChunks output chunk by chunk", async () => {
    mocks.readFileInChunks.mockImplementation(
      async (options: { chunkSize: number }, callback: ChunkCallback) => {
        setTimeout(() => {
          for (let offset = 0; offset < file.length; offset += options.chunkSize) {
            callback({ data: base64(file.subarray(offset, offset + options.chunkSize)) });
          }
          callback({ data: "" });
        }, 0);
        return "callback-id";
      },
    );

    expect(await hashCachedFile("app.apk")).toEqual({ kind: "hashed", sha256: expected });
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("falls back to ranged reads when chunked reading is not implemented", async () => {
    mocks.readFileInChunks.mockRejectedValue({ code: "UNIMPLEMENTED" });
    mocks.readFile.mockImplementation(
      async ({ offset, length }: { offset: number; length: number }) => ({
        data: base64(file.subarray(offset, offset + length)),
      }),
    );

    expect(await hashCachedFile("app.apk")).toEqual({ kind: "hashed", sha256: expected });
    expect(mocks.readFile).toHaveBeenCalledTimes(3);
  });

  it("starts over rather than trust a hash a failed chunked read had begun", async () => {
    mocks.readFileInChunks.mockImplementation(
      async (_options: unknown, callback: ChunkCallback) => {
        setTimeout(() => {
          callback({ data: base64(file.subarray(0, 100)) });
          callback(null, new Error("I/O error"));
        }, 0);
        return "id";
      },
    );
    mocks.readFile.mockImplementation(
      async ({ offset, length }: { offset: number; length: number }) => ({
        data: base64(file.subarray(offset, offset + length)),
      }),
    );

    expect(await hashCachedFile("app.apk")).toEqual({ kind: "hashed", sha256: expected });
  });

  it("hashes the whole file when an older plugin ignores the range", async () => {
    mocks.readFileInChunks.mockRejectedValue(new Error("not implemented"));
    mocks.readFile.mockResolvedValue({ data: base64(file) });

    expect(await hashCachedFile("app.apk")).toEqual({ kind: "hashed", sha256: expected });
    expect(mocks.readFile).toHaveBeenCalledTimes(1);
  });

  it("reports unavailable when neither way of reading works", async () => {
    mocks.readFileInChunks.mockRejectedValue(new Error("not implemented"));
    mocks.readFile.mockRejectedValue(new Error("no such file"));

    expect(await hashCachedFile("app.apk")).toMatchObject({
      kind: "unavailable",
      reason: expect.stringContaining("no such file"),
    });
  });
});
