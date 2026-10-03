import type { RecordingRuleLayer, RecordingRuleScope } from "@capuchoo/core";
import type { Db } from "../db/database";
import type { RecordingRule } from "../db/schema";

export interface RuleTarget {
  appId: string;
  scope: RecordingRuleScope;
  channelId: string | null;
  deviceUuid: string | null;
}

export function listRules(db: Db, appId: string): Promise<RecordingRule[]> {
  return db
    .selectFrom("recording_rules")
    .selectAll()
    .where("app_id", "=", appId)
    .orderBy("scope")
    .orderBy("updated_at", "desc")
    .execute();
}

export function findRule(db: Db, target: RuleTarget): Promise<RecordingRule | undefined> {
  let builder = db
    .selectFrom("recording_rules")
    .selectAll()
    .where("app_id", "=", target.appId)
    .where("scope", "=", target.scope);
  if (target.scope === "channel") builder = builder.where("channel_id", "=", target.channelId);
  if (target.scope === "device") builder = builder.where("device_uuid", "=", target.deviceUuid);
  return builder.executeTakeFirst();
}

export function findRuleById(db: Db, id: string): Promise<RecordingRule | undefined> {
  return db.selectFrom("recording_rules").selectAll().where("id", "=", id).executeTakeFirst();
}

export interface RuleWrite extends RuleTarget {
  policy: unknown;
  liveUntil: Date | null;
  updatedBy: string | null;
  now: Date;
}

/** One rule per target; a write replaces the target's policy and live deadline. */
export async function saveRule(db: Db, write: RuleWrite): Promise<RecordingRule> {
  const existing = await findRule(db, write);
  const policy = JSON.stringify(write.policy ?? {});
  if (existing) {
    return db
      .updateTable("recording_rules")
      .set({
        policy,
        live_until: write.liveUntil,
        updated_by: write.updatedBy,
        updated_at: write.now,
      })
      .where("id", "=", existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }
  return db
    .insertInto("recording_rules")
    .values({
      app_id: write.appId,
      scope: write.scope,
      channel_id: write.scope === "channel" ? write.channelId : null,
      device_uuid: write.scope === "device" ? write.deviceUuid : null,
      policy,
      live_until: write.liveUntil,
      updated_by: write.updatedBy,
      updated_at: write.now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deleteRule(db: Db, id: string): Promise<void> {
  await db.deleteFrom("recording_rules").where("id", "=", id).execute();
}

/** The rules that apply to one device, as layers for `resolveRecordingPolicy`. */
export function layersFor(
  rules: readonly RecordingRule[],
  channelId: string | null,
  deviceUuid: string | null,
): RecordingRuleLayer[] {
  return rules
    .filter(
      (rule) =>
        rule.scope === "app" ||
        (rule.scope === "channel" && channelId !== null && rule.channel_id === channelId) ||
        (rule.scope === "device" && deviceUuid !== null && rule.device_uuid === deviceUuid),
    )
    .map((rule) => ({
      scope: rule.scope,
      patch: (rule.policy ?? {}) as RecordingRuleLayer["patch"],
      liveUntil: rule.live_until ? rule.live_until.getTime() : null,
    }));
}
