import type { Context } from "hono";
import type { Principal } from "../auth/principal";
import type { Config } from "../config";
import type { Db } from "../db/database";
import { unauthorized } from "../lib/errors";
import type { Logger } from "../lib/logger";
import type { EventHub } from "../services/event-hub";
import type { StorageDriver } from "../storage/driver";
import type { RequestCache } from "../services/request-cache";
import type { BackgroundTasks } from "../lib/background";
import type { LoadGuard } from "../lib/load-guard";
import type { CiRuntime } from "../services/ci-runtime";
import type { AssistRegistry } from "../services/assist/registry";
import type { WatchRegistry } from "../services/live/watch-registry";

/** Everything a route needs, built once at boot and injected so tests can swap parts. */
export interface Deps {
  db: Db;
  config: Config;
  storage: StorageDriver;
  logger: Logger;
  hub: EventHub;
  cache: RequestCache;
  tasks: BackgroundTasks;
  load: LoadGuard;
  ci: CiRuntime;
  assist: AssistRegistry;
  watch: WatchRegistry;
  now: () => Date;
}

export interface AppEnv {
  Variables: {
    deps: Deps;
    requestId: string;
    principal: Principal | null;
    logger: Logger;
    clientIp: string;
  };
}

export type AppContext = Context<AppEnv>;

export function deps(c: AppContext): Deps {
  return c.get("deps");
}

/** The authenticated caller; 401 when there is none. */
export function principal(c: AppContext): Principal {
  const who = c.get("principal");
  if (!who) throw unauthorized();
  return who;
}
