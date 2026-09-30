import { Readable } from "node:stream";
import { sql } from "kysely";
import type { Db } from "../db/database";
import { assertStorageKey, type ByteRange, type StorageDriver, type StoredObject } from "./driver";

const CHUNK_BYTES = 1024 * 1024;

/**
 * Artefacts as 1 MiB chunks in PostgreSQL. For small installs and hosts without a volume; reads
 * fetch one chunk at a time so memory stays flat regardless of artefact size.
 */
export function createPostgresStorage(db: Db): StorageDriver {
  return {
    name: "postgres",

    async put(key: string, body: Readable, contentType: string): Promise<number> {
      assertStorageKey(key);
      let size = 0;
      let index = 0;
      let pending: Buffer[] = [];
      let pendingBytes = 0;

      await db.transaction().execute(async (trx) => {
        await trx.deleteFrom("blobs").where("key", "=", key).execute();
        await trx
          .insertInto("blobs")
          .values({ key, size_bytes: 0, content_type: contentType })
          .execute();

        const flush = async (all: boolean) => {
          while (pendingBytes >= CHUNK_BYTES || (all && pendingBytes > 0)) {
            const joined = Buffer.concat(pending);
            const chunk = joined.subarray(0, Math.min(CHUNK_BYTES, joined.length));
            const rest = joined.subarray(chunk.length);
            await trx
              .insertInto("blob_chunks")
              .values({ key, idx: index, data: Buffer.from(chunk) })
              .execute();
            index += 1;
            pending = rest.length ? [rest] : [];
            pendingBytes = rest.length;
          }
        };

        for await (const piece of body) {
          const buffer = Buffer.isBuffer(piece) ? piece : Buffer.from(piece as Uint8Array);
          size += buffer.length;
          pending.push(buffer);
          pendingBytes += buffer.length;
          await flush(false);
        }
        await flush(true);
        await trx.updateTable("blobs").set({ size_bytes: size }).where("key", "=", key).execute();
      });

      return size;
    },

    async get(key: string, range?: ByteRange) {
      assertStorageKey(key);
      const meta = await this.stat(key);
      if (!meta) throw Object.assign(new Error(`No object ${key}`), { code: "ENOENT" });
      const start = range?.start ?? 0;
      const end = range?.end ?? meta.size - 1;
      const first = Math.floor(start / CHUNK_BYTES);
      const last = Math.floor(end / CHUNK_BYTES);

      async function* chunks(): AsyncGenerator<Buffer> {
        for (let idx = first; idx <= last; idx += 1) {
          const row = await db
            .selectFrom("blob_chunks")
            .select("data")
            .where("key", "=", key)
            .where("idx", "=", idx)
            .executeTakeFirst();
          if (!row) return;
          const data = Buffer.from(row.data);
          const from = idx === first ? start - idx * CHUNK_BYTES : 0;
          const to = idx === last ? end - idx * CHUNK_BYTES + 1 : data.length;
          yield data.subarray(from, to);
        }
      }

      return { body: Readable.from(chunks()), ...meta };
    },

    async stat(key: string): Promise<StoredObject | null> {
      assertStorageKey(key);
      const row = await db
        .selectFrom("blobs")
        .select(["size_bytes", "content_type"])
        .where("key", "=", key)
        .executeTakeFirst();
      return row ? { size: Number(row.size_bytes), contentType: row.content_type } : null;
    },

    async delete(key: string): Promise<void> {
      assertStorageKey(key);
      await db.deleteFrom("blobs").where("key", "=", key).execute();
    },

    async healthy(): Promise<boolean> {
      try {
        await sql`SELECT 1`.execute(db);
        return true;
      } catch {
        return false;
      }
    },
  };
}
