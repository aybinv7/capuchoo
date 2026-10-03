import { Readable } from "node:stream";
import type { AppContext } from "./context";
import { Meter, type MeasuredStream } from "./multipart";
import { badRequest, tooLarge } from "../lib/errors";

export const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);

/** A raw request body as a size-capped, hashed stream; never buffered whole. */
export function meteredBody(
  c: AppContext,
  maxBytes: number,
  magic: Buffer | null,
  magicError = badRequest("The body is not in the expected format", "bad_format"),
): MeasuredStream {
  const declared = Number(c.req.header("content-length") ?? 0);
  if (declared > maxBytes) throw tooLarge(`The body exceeds ${Math.round(maxBytes / 1024)} KiB`);
  const body = c.req.raw.body;
  if (!body) throw badRequest("The request has no body", "no_body");
  const meter = new Meter(maxBytes, magic, magicError);
  const source = Readable.fromWeb(body as never);
  source.on("error", (error) => meter.destroy(error));
  source.pipe(meter);
  return {
    stream: meter,
    digest: () => ({ sha256: meter.hash.digest("hex"), bytes: meter.bytes }),
  };
}
