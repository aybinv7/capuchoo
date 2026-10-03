import type { DatabaseSource } from "../database/types.js";
import type { Track } from "../recorder/types.js";

/** Every registered database, each into the `database` lane under its own name. */
export function createDatabaseTrack(
  sources: readonly DatabaseSource[],
  tables: () => string[] | "all",
): Track {
  let running: DatabaseSource[] = [];

  return {
    name: "database",
    async start(ctx) {
      if (running.length > 0) return;
      running = [...sources];
      await Promise.all(
        running.map(async (source) => {
          const sink = {
            changeset: (bytes: Uint8Array, at: number) =>
              ctx.push("database", { db: source.name, kind: "changeset", bytes }, at),
            change: (change: unknown, at: number) =>
              ctx.push("database", { db: source.name, kind: "change", change }, at),
            schema: (described: unknown) =>
              ctx.push("database", { db: source.name, kind: "schema", tables: described }),
          };
          try {
            const result = await source.start(sink, tables());
            if (!result.supported) {
              ctx.push("marker", {
                kind: "database-unsupported",
                db: source.name,
                reason: result.reason,
              });
            }
          } catch (error) {
            ctx.logger.warn(`database source ${source.name} failed to start`, error);
          }
        }),
      );
    },
    stop() {
      const stopping = running;
      running = [];
      for (const source of stopping) void Promise.resolve(source.stop()).catch(() => undefined);
    },
  };
}
