import type { Environment } from "@capuchoo/core";
import type { Db } from "../db/database";
import type { Channel, ChannelAction, ChannelUpdate } from "../db/schema";

export function listChannels(db: Db, appId: string): Promise<Channel[]> {
  return db
    .selectFrom("channels")
    .selectAll()
    .where("app_id", "=", appId)
    .orderBy("name")
    .execute();
}

export function findChannel(db: Db, id: string): Promise<Channel | undefined> {
  return db.selectFrom("channels").selectAll().where("id", "=", id).executeTakeFirst();
}

export function findChannelByName(
  db: Db,
  appId: string,
  name: string,
): Promise<Channel | undefined> {
  return db
    .selectFrom("channels")
    .selectAll()
    .where("app_id", "=", appId)
    .where("name", "=", name)
    .executeTakeFirst();
}

export async function createChannel(
  db: Db,
  input: {
    appId: string;
    name: string;
    environment: Environment;
    kind: "release" | "client";
    baseChannelId: string | null;
    isPublic?: boolean;
    allowDeviceSelfSet?: boolean;
  },
): Promise<Channel> {
  return db
    .insertInto("channels")
    .values({
      app_id: input.appId,
      name: input.name,
      environment: input.environment,
      kind: input.kind,
      base_channel_id: input.baseChannelId,
      is_public: input.isPublic ?? false,
      allow_device_self_set: input.allowDeviceSelfSet ?? false,
      updated_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateChannel(db: Db, id: string, patch: ChannelUpdate): Promise<Channel> {
  return db
    .updateTable("channels")
    .set({ ...patch, updated_at: new Date() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deleteChannel(db: Db, id: string): Promise<void> {
  await db.deleteFrom("channels").where("id", "=", id).execute();
}

export async function hasEverPointed(db: Db, channelId: string): Promise<boolean> {
  const row = await db
    .selectFrom("channel_events")
    .select("id")
    .where("channel_id", "=", channelId)
    .where("action", "in", ["point_bundle", "point_native", "rollback_bundle", "rollback_native"])
    .limit(1)
    .executeTakeFirst();
  return Boolean(row);
}

export async function servedByChannel(
  db: Db,
  channelId: string,
  artefactId: string,
): Promise<boolean> {
  const row = await db
    .selectFrom("channel_events")
    .select("id")
    .where("channel_id", "=", channelId)
    .where("to_id", "=", artefactId)
    .limit(1)
    .executeTakeFirst();
  return Boolean(row);
}

export async function recordChannelEvent(
  db: Db,
  input: {
    channelId: string;
    appId: string;
    action: ChannelAction;
    fromId: string | null;
    toId: string | null;
    fromVersion: string | null;
    toVersion: string | null;
    actorUserId: string | null;
    actorApiKeyId: string | null;
    reason: string | null;
  },
): Promise<void> {
  await db
    .insertInto("channel_events")
    .values({
      channel_id: input.channelId,
      app_id: input.appId,
      action: input.action,
      from_id: input.fromId,
      to_id: input.toId,
      from_version: input.fromVersion,
      to_version: input.toVersion,
      actor_user_id: input.actorUserId,
      actor_api_key_id: input.actorApiKeyId,
      reason: input.reason,
    })
    .execute();
}

export function channelHistory(db: Db, channelId: string, limit: number) {
  return db
    .selectFrom("channel_events as e")
    .leftJoin("users", "users.id", "e.actor_user_id")
    .select([
      "e.id",
      "e.action",
      "e.from_id",
      "e.to_id",
      "e.from_version",
      "e.to_version",
      "e.reason",
      "e.created_at",
      "e.actor_api_key_id",
      "users.email as actor_email",
    ])
    .where("e.channel_id", "=", channelId)
    .orderBy("e.id", "desc")
    .limit(limit)
    .execute();
}

/** Channels whose pointers reference an artefact, so a delete can refuse. */
export function channelsServing(db: Db, artefactId: string) {
  return db
    .selectFrom("channels")
    .select(["id", "name"])
    .where((eb) =>
      eb.or([eb("current_bundle_id", "=", artefactId), eb("current_native_id", "=", artefactId)]),
    )
    .execute();
}

export function clientsOf(db: Db, baseChannelId: string) {
  return db
    .selectFrom("channels")
    .select(["id", "name"])
    .where("base_channel_id", "=", baseChannelId)
    .execute();
}
