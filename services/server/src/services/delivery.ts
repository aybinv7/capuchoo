import { canPoint, type PointerVerdict } from "@capuchoo/core";
import { requireDeliverRole, type AppAccess } from "../access/app-access";
import { actorColumns, type Principal } from "../auth/principal";
import type { Bundle, Channel, ChannelAction, NativeBuild } from "../db/schema";
import type { Deps } from "../http/context";
import { conflict, notFound } from "../lib/errors";
import { findBundle, findNativeBuild } from "../repositories/artefacts";
import { writeAudit } from "../repositories/audit";
import {
  findChannel,
  recordChannelEvent,
  servedByChannel,
  updateChannel,
} from "../repositories/channels";

export type Artefact = { kind: "ota"; row: Bundle } | { kind: "native"; row: NativeBuild };

async function currentOf(deps: Deps, channel: Channel) {
  const [bundle, native] = await Promise.all([
    channel.current_bundle_id
      ? findBundle(deps.db, channel.current_bundle_id)
      : Promise.resolve(undefined),
    channel.current_native_id
      ? findNativeBuild(deps.db, channel.current_native_id)
      : Promise.resolve(undefined),
  ]);
  return { bundle, native };
}

/** The pure verdict for pointing a channel at an artefact, with every fact loaded. */
export async function evaluatePointer(
  deps: Deps,
  channel: Channel,
  artefact: Artefact,
  rollback: boolean,
): Promise<PointerVerdict> {
  const { bundle, native } = await currentOf(deps, channel);
  const servedByBase =
    channel.kind === "client" && channel.base_channel_id
      ? await servedByChannel(deps.db, channel.base_channel_id, artefact.row.id)
      : undefined;
  const current =
    artefact.kind === "ota"
      ? bundle
        ? { versionName: bundle.version_name }
        : null
      : native
        ? { versionName: native.version_name, versionCode: native.version_code }
        : null;

  return canPoint({
    channel: {
      appId: channel.app_id,
      name: channel.name,
      environment: channel.environment,
      kind: channel.kind,
      iosEnabled: channel.ios_enabled,
      androidEnabled: channel.android_enabled,
      currentNativeCode: native?.version_code ?? null,
      currentBundleGate: bundle?.min_native_version ?? null,
      currentVersion: current,
    },
    artefact: {
      appId: artefact.row.app_id,
      kind: artefact.kind,
      platform: artefact.row.platform,
      flavour: artefact.row.flavour,
      versionName: artefact.row.version_name,
      versionCode: artefact.kind === "native" ? artefact.row.version_code : null,
      minNativeVersion: artefact.kind === "ota" ? artefact.row.min_native_version : null,
    },
    servedByBase,
    rollback,
  });
}

function publishChannel(deps: Deps, channel: Channel): void {
  deps.cache.invalidate(`app:${channel.app_id}`);
  deps.hub.publish({ type: "channel", appId: channel.app_id, data: channel });
}

/**
 * Moves a channel's pointer. Refusals come from `canPoint`; the move, its history row and the audit
 * entry are written together, and a rollback leaves the channel accepting downgrades until the next
 * forward move.
 */
export async function pointChannel(
  deps: Deps,
  input: {
    access: AppAccess;
    principal: Principal;
    channel: Channel;
    artefact: Artefact;
    rollback: boolean;
    reason: string | null;
    ip: string | null;
  },
): Promise<Channel> {
  const { access, principal, channel, artefact, rollback } = input;
  requireDeliverRole(access, channel.environment, rollback ? "Rolling back" : "Delivering");

  const verdict = await evaluatePointer(deps, channel, artefact, rollback);
  if (!verdict.ok) throw conflict(verdict.message, verdict.reason);

  const fromId = artefact.kind === "ota" ? channel.current_bundle_id : channel.current_native_id;
  if (verdict.direction === "same" && fromId === artefact.row.id) return channel;

  const current = await currentOf(deps, channel);
  const fromVersion =
    artefact.kind === "ota"
      ? (current.bundle?.version_name ?? null)
      : (current.native?.version_name ?? null);
  const action: ChannelAction =
    artefact.kind === "ota"
      ? rollback
        ? "rollback_bundle"
        : "point_bundle"
      : rollback
        ? "rollback_native"
        : "point_native";

  const updated = await deps.db.transaction().execute(async (trx) => {
    const locked = await trx
      .selectFrom("channels")
      .selectAll()
      .where("id", "=", channel.id)
      .forUpdate()
      .executeTakeFirst();
    if (!locked) throw notFound("Channel");
    const lockedFrom =
      artefact.kind === "ota" ? locked.current_bundle_id : locked.current_native_id;
    if (lockedFrom !== fromId)
      throw conflict("The channel changed while this request was in flight. Retry.", "stale");

    const row = await trx
      .updateTable("channels")
      .set({
        ...(artefact.kind === "ota"
          ? { current_bundle_id: artefact.row.id }
          : { current_native_id: artefact.row.id }),
        ...(artefact.kind === "ota" ? { allow_downgrade: rollback } : {}),
        updated_at: new Date(),
      })
      .where("id", "=", channel.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await recordChannelEvent(trx, {
      channelId: channel.id,
      appId: channel.app_id,
      action,
      fromId,
      toId: artefact.row.id,
      fromVersion,
      toVersion: artefact.row.version_name,
      actorUserId: principal.userId,
      actorApiKeyId: actorColumns(principal).actor_api_key_id,
      reason: input.reason,
    });
    await writeAudit(trx, {
      organizationId: access.app.organization_id,
      appId: access.app.id,
      ...toAuditActor(principal),
      action: `channel.${action}`,
      targetType: "channel",
      targetId: channel.id,
      details: {
        channel: channel.name,
        from: fromVersion,
        to: artefact.row.version_name,
        reason: input.reason,
      },
      ip: input.ip,
    });
    return row;
  });

  publishChannel(deps, updated);
  return updated;
}

function toAuditActor(principal: Principal) {
  const actor = actorColumns(principal);
  return { actorUserId: actor.actor_user_id, actorApiKeyId: actor.actor_api_key_id };
}

/** Pauses or resumes a channel: a paused channel serves nothing until resumed. */
export async function setChannelPaused(
  deps: Deps,
  input: {
    access: AppAccess;
    principal: Principal;
    channel: Channel;
    paused: boolean;
    reason: string | null;
    ip: string | null;
  },
): Promise<Channel> {
  requireDeliverRole(
    input.access,
    input.channel.environment,
    input.paused ? "Pausing" : "Resuming",
  );
  if (input.channel.paused === input.paused) return input.channel;
  const updated = await deps.db.transaction().execute(async (trx) => {
    const row = await updateChannel(trx, input.channel.id, { paused: input.paused });
    await recordChannelEvent(trx, {
      channelId: row.id,
      appId: row.app_id,
      action: input.paused ? "pause" : "resume",
      fromId: null,
      toId: null,
      fromVersion: null,
      toVersion: null,
      actorUserId: input.principal.userId,
      actorApiKeyId: actorColumns(input.principal).actor_api_key_id,
      reason: input.reason,
    });
    await writeAudit(trx, {
      organizationId: input.access.app.organization_id,
      appId: input.access.app.id,
      ...toAuditActor(input.principal),
      action: input.paused ? "channel.pause" : "channel.resume",
      targetType: "channel",
      targetId: row.id,
      details: { channel: row.name, reason: input.reason },
      ip: input.ip,
    });
    return row;
  });
  publishChannel(deps, updated);
  return updated;
}

/** Loads a channel of the app or 404s; guards against ids from another app. */
export async function channelOfApp(deps: Deps, appId: string, channelId: string): Promise<Channel> {
  const channel = await findChannel(deps.db, channelId);
  if (!channel || channel.app_id !== appId) throw notFound("Channel");
  return channel;
}
