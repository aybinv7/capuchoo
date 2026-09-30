import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { migrateToLatest } from "./db/migrator";
import { createDeps } from "./deps";
import { bootstrapAdmin } from "./services/auth-service";
import { scheduleRetention } from "./services/retention";

async function main(): Promise<void> {
  const config = loadConfig();
  const deps = createDeps(config);

  if (config.MIGRATE_ON_BOOT) {
    const result = await migrateToLatest(deps.db);
    const applied =
      result.results
        ?.filter((entry) => entry.status === "Success")
        .map((entry) => entry.migrationName) ?? [];
    if (applied.length) deps.logger.info("migrations applied", { applied });
  }
  await bootstrapAdmin(deps);
  const stopRetention = scheduleRetention(deps);

  const server = serve(
    { fetch: createApp(deps).fetch, port: config.PORT, hostname: config.HOST },
    (info) =>
      deps.logger.info("capuchoo server listening", {
        port: info.port,
        storage: deps.storage.name,
      }),
  );
  const http = server as import("node:http").Server;
  http.requestTimeout = 20 * 60 * 1000;
  http.headersTimeout = 65_000;
  http.keepAliveTimeout = 61_000;

  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    deps.logger.info("shutting down", { signal });
    stopRetention();
    const force = setTimeout(() => process.exit(1), 25_000);
    force.unref();
    server.close(async () => {
      await deps.tasks.idle();
      await deps.db.destroy();
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (error) => deps.logger.error("unhandled rejection", { error }));
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
