import type { Environment } from "@capuchoo/core";
import type { Db } from "../db/database";

const PRECEDENCE = { all: 0, dev: 1, staging: 1, prod: 1 } as const;

function parse(value: string, type: string): unknown {
  switch (type) {
    case "number": {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    }
    case "boolean":
      return value === "true";
    case "json":
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}

/** Remote config for a channel: `all` values, overridden by the environment, overridden by the channel. */
export async function resolveAppConfig(
  db: Db,
  appId: string,
  environment: Environment | null,
  channel: string | null,
): Promise<Record<string, unknown>> {
  const rows = await db
    .selectFrom("app_config")
    .select(["key", "value", "value_type", "environment", "channel"])
    .where("app_id", "=", appId)
    .where("environment", "in", environment ? ["all", environment] : ["all"])
    .where((eb) =>
      channel
        ? eb.or([eb("channel", "is", null), eb("channel", "=", channel)])
        : eb("channel", "is", null),
    )
    .execute();
  rows.sort(
    (a, b) =>
      PRECEDENCE[a.environment] - PRECEDENCE[b.environment] ||
      Number(a.channel !== null) - Number(b.channel !== null),
  );
  const config: Record<string, unknown> = {};
  for (const row of rows) config[row.key] = parse(row.value, row.value_type);
  return config;
}

export function listAppConfig(db: Db, appId: string) {
  return db
    .selectFrom("app_config")
    .selectAll()
    .where("app_id", "=", appId)
    .orderBy("key")
    .execute();
}

export async function upsertAppConfig(
  db: Db,
  input: {
    appId: string;
    environment: "all" | Environment;
    channel: string | null;
    key: string;
    value: string;
    valueType: "string" | "number" | "boolean" | "json";
  },
) {
  const existing = await db
    .selectFrom("app_config")
    .select("id")
    .where("app_id", "=", input.appId)
    .where("environment", "=", input.environment)
    .where("key", "=", input.key)
    .where((eb) => (input.channel ? eb("channel", "=", input.channel) : eb("channel", "is", null)))
    .executeTakeFirst();
  if (existing) {
    return db
      .updateTable("app_config")
      .set({ value: input.value, value_type: input.valueType, updated_at: new Date() })
      .where("id", "=", existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }
  return db
    .insertInto("app_config")
    .values({
      app_id: input.appId,
      environment: input.environment,
      channel: input.channel,
      key: input.key,
      value: input.value,
      value_type: input.valueType,
      updated_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deleteAppConfig(db: Db, appId: string, id: string): Promise<boolean> {
  const result = await db
    .deleteFrom("app_config")
    .where("app_id", "=", appId)
    .where("id", "=", id)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}
