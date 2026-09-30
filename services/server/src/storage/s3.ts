import { Readable } from "node:stream";
import { AwsClient } from "aws4fetch";
import { assertStorageKey, type ByteRange, type StorageDriver, type StoredObject } from "./driver";

export interface S3Options {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const PART_BYTES = 16 * 1024 * 1024;

/** Any S3-compatible store (MinIO, R2, AWS). Large uploads go through multipart in 16 MiB parts. */
export function createS3Storage(options: S3Options): StorageDriver {
  const client = new AwsClient({
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    service: "s3",
    region: options.region,
  });
  const base = `${options.endpoint.replace(/\/+$/, "")}/${options.bucket}`;
  const url = (key: string) => {
    assertStorageKey(key);
    return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  };

  async function expectOk(response: Response, action: string): Promise<Response> {
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`S3 ${action} failed: ${response.status} ${text.slice(0, 200)}`);
    }
    return response;
  }

  async function* parts(body: Readable): AsyncGenerator<Buffer> {
    let pending: Buffer[] = [];
    let size = 0;
    for await (const piece of body) {
      const buffer = Buffer.isBuffer(piece) ? piece : Buffer.from(piece as Uint8Array);
      pending.push(buffer);
      size += buffer.length;
      if (size >= PART_BYTES) {
        yield Buffer.concat(pending);
        pending = [];
        size = 0;
      }
    }
    if (size > 0) yield Buffer.concat(pending);
  }

  return {
    name: "s3",

    async put(key: string, body: Readable, contentType: string): Promise<number> {
      const target = url(key);
      const create = await expectOk(
        await client.fetch(`${target}?uploads`, {
          method: "POST",
          headers: { "content-type": contentType },
        }),
        "create multipart",
      );
      const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(await create.text())?.[1];
      if (!uploadId) throw new Error("S3 did not return an UploadId");

      const etags: string[] = [];
      let total = 0;
      try {
        let number = 1;
        for await (const part of parts(body)) {
          total += part.length;
          const response = await expectOk(
            await client.fetch(
              `${target}?partNumber=${number}&uploadId=${encodeURIComponent(uploadId)}`,
              {
                method: "PUT",
                body: part,
              },
            ),
            `upload part ${number}`,
          );
          etags.push(response.headers.get("etag") ?? "");
          number += 1;
        }
        const manifest = etags
          .map(
            (etag, index) =>
              `<Part><PartNumber>${index + 1}</PartNumber><ETag>${etag}</ETag></Part>`,
          )
          .join("");
        await expectOk(
          await client.fetch(`${target}?uploadId=${encodeURIComponent(uploadId)}`, {
            method: "POST",
            body: `<CompleteMultipartUpload>${manifest}</CompleteMultipartUpload>`,
          }),
          "complete multipart",
        );
        return total;
      } catch (error) {
        await client
          .fetch(`${target}?uploadId=${encodeURIComponent(uploadId)}`, { method: "DELETE" })
          .catch(() => undefined);
        throw error;
      }
    },

    async get(key: string, range?: ByteRange) {
      const response = await expectOk(
        await client.fetch(
          url(key),
          range ? { headers: { range: `bytes=${range.start}-${range.end}` } } : {},
        ),
        "get",
      );
      const meta = await this.stat(key);
      if (!response.body || !meta) throw new Error(`S3 object ${key} has no body`);
      return { body: Readable.fromWeb(response.body as never), ...meta };
    },

    async stat(key: string): Promise<StoredObject | null> {
      const response = await client.fetch(url(key), { method: "HEAD" });
      if (response.status === 404) return null;
      await expectOk(response, "head");
      return {
        size: Number(response.headers.get("content-length") ?? 0),
        contentType: response.headers.get("content-type") ?? "application/octet-stream",
      };
    },

    async delete(key: string): Promise<void> {
      const response = await client.fetch(url(key), { method: "DELETE" });
      if (response.status !== 404) await expectOk(response, "delete");
    },

    async directUrl(key: string, ttlSeconds: number): Promise<string> {
      const signed = await client.sign(`${url(key)}?X-Amz-Expires=${ttlSeconds}`, {
        method: "GET",
        aws: { signQuery: true },
      });
      return signed.url;
    },

    async healthy(): Promise<boolean> {
      try {
        const response = await client.fetch(`${base}?max-keys=1`, { method: "GET" });
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}
