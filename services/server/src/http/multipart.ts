import { createHash } from "node:crypto";
import { Readable, Transform, type TransformCallback } from "node:stream";
import busboy from "busboy";
import { badRequest, tooLarge } from "../lib/errors";

export interface MeasuredStream {
  stream: Readable;
  /** Resolves once the stream has been fully consumed. */
  digest: () => { sha256: string; bytes: number };
}

class Meter extends Transform {
  readonly hash = createHash("sha256");
  bytes = 0;
  private first = true;

  constructor(
    private readonly maxBytes: number,
    private readonly magic: Buffer | null,
  ) {
    super();
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback): void {
    if (this.first && this.magic) {
      this.first = false;
      if (
        chunk.length < this.magic.length ||
        !chunk.subarray(0, this.magic.length).equals(this.magic)
      ) {
        done(badRequest("The uploaded file is not a zip archive", "not_zip"));
        return;
      }
    }
    this.bytes += chunk.length;
    if (this.bytes > this.maxBytes) {
      done(tooLarge(`The upload exceeds ${Math.round(this.maxBytes / 1048576)} MiB`));
      return;
    }
    this.hash.update(chunk);
    done(null, chunk);
  }
}

export const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Streams a multipart body. `onFile` runs once, after every field that precedes the file, so the
 * caller can authorize before a single file byte is read; the file is never buffered in memory.
 */
export async function streamMultipart<T>(input: {
  body: ReadableStream<Uint8Array> | null;
  contentType: string | undefined;
  fileField: string;
  maxBytes: number;
  magic?: Buffer | null;
  onFile: (fields: Record<string, string>, file: MeasuredStream, filename: string) => Promise<T>;
}): Promise<{ fields: Record<string, string>; result: T }> {
  if (!input.body || !input.contentType?.startsWith("multipart/form-data")) {
    throw badRequest("Expected a multipart/form-data upload");
  }

  const parser = busboy({
    headers: { "content-type": input.contentType },
    limits: { files: 1, fields: 40, fieldSize: 64 * 1024, fileSize: input.maxBytes + 1 },
  });
  const fields: Record<string, string> = {};

  return new Promise((resolve, reject) => {
    let handled: Promise<T> | null = null;
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    parser.on("field", (name, value) => {
      fields[name] = value;
    });

    parser.on("file", (name, file, info) => {
      if (name !== input.fileField || handled) {
        file.resume();
        return;
      }
      const meter = new Meter(input.maxBytes, input.magic ?? null);
      file.on("limit", () =>
        meter.destroy(tooLarge(`The upload exceeds ${Math.round(input.maxBytes / 1048576)} MiB`)),
      );
      file.pipe(meter);
      handled = input.onFile(
        { ...fields },
        {
          stream: meter,
          digest: () => ({ sha256: meter.hash.digest("hex"), bytes: meter.bytes }),
        },
        info.filename,
      );
      handled.catch((error: unknown) => {
        file.unpipe(meter);
        file.resume();
        fail(error);
      });
    });

    parser.on("error", fail);
    parser.on("close", () => {
      if (!handled) {
        fail(badRequest(`The upload carried no "${input.fileField}" file`, "no_file"));
        return;
      }
      handled.then((result) => {
        if (!settled) {
          settled = true;
          resolve({ fields, result });
        }
      }, fail);
    });

    const source = Readable.fromWeb(input.body as never);
    source.on("error", fail);
    source.pipe(parser);
  });
}
