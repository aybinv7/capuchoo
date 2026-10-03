import type { Config } from "./config";
import { createDatabase, createPostgresDialect, type Db } from "./db/database";
import type { Deps } from "./http/context";
import { BackgroundTasks } from "./lib/background";
import { LoadGuard, deviceInflightCap } from "./lib/load-guard";
import { createLogger } from "./lib/logger";
import { CiRuntime } from "./services/ci-runtime";
import { EventHub } from "./services/event-hub";
import { RequestCache } from "./services/request-cache";
import type { StorageDriver } from "./storage/driver";
import { createFsStorage } from "./storage/fs";
import { createPostgresStorage } from "./storage/postgres";
import { createS3Storage } from "./storage/s3";

export function createStorage(config: Config, db: Db): StorageDriver {
  switch (config.STORAGE_DRIVER) {
    case "s3":
      return createS3Storage({
        endpoint: config.S3_ENDPOINT!,
        region: config.S3_REGION,
        bucket: config.S3_BUCKET!,
        accessKeyId: config.S3_ACCESS_KEY_ID!,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
      });
    case "postgres":
      return createPostgresStorage(db);
    default:
      return createFsStorage(config.STORAGE_DIR);
  }
}

/** Production wiring: pooled PostgreSQL, the configured storage, JSON logs. */
export function createDeps(config: Config): Deps {
  const logger = createLogger(config.LOG_LEVEL);
  const db = createDatabase(createPostgresDialect(config));
  return {
    db,
    config,
    storage: createStorage(config, db),
    logger,
    hub: new EventHub(),
    cache: new RequestCache(),
    tasks: new BackgroundTasks(logger, config.BACKGROUND_TASK_LIMIT),
    load: new LoadGuard(deviceInflightCap(config), Math.random, logger),
    ci: new CiRuntime(config.SECRET_KEY),
    now: () => new Date(),
  };
}
