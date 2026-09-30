import { canPoint, type PointerVerdict } from "@capuchoo/core";
import { requireDeliverRole, type AppAccess } from "../access/app-access";
import { actorColumns, type Principal } from "../auth/principal";
import type { Bundle, Channel, ChannelAction, NativeBuild } from "../db/schema";
import type { Deps } from "../http/context";
import { badRequest, conflict, notFound } from "../lib/errors";
import { findBundle, findNativeBuild } from "../repositories/artefacts";
import { writeAudit } from "../repositories/audit";
import { publishChannel } from "./live-events";
import {
  findChannel,
  recordChannelEvent,
  servedByChannel,
  updateChannel,
} from "../repositories/channels";

export type Artefact = { kind: "ota"; row: Bundle } | { kind: "native"; row: NativeBuild };

interface PointerState {
  bundle: Bundle | undefined;
  native: NativeBuild | undefined;
}

async function currentOf(deps: Deps, channel: Channel): Promise<PointerState> {
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

/** The pure verdict for pointing a channel, in the given pointer state, at an artefact. */
export async function evaluatePointer(
  deps: Deps,
  channel: Channel,
  state: PointerState,
  artefact: Artefact,
  rollback: boolean,
): Promise<PointerVerdict> {
  const servedByBase =
    channel.kind === "client" && channel.base_channel_id
      ? await servedByChannel(deps.db, channel.base_channel_id, artefact.row.id)
      : undefined;
  const current =
    artefact.kind === "ota"
      ? state.bundle
        ? { versionName: state.bundle.version_name }
        : null
      : state.native
        ? { versionName: state.native.version_name, versionCode: state.native.version_code }
        : null;

  return canPoint({
    channel: {
      appId: channel.app_id,
      name: channel.name,
      environment: channel.environment,
      kind: channel.kind,
      iosEnabled: channel.ios_enabled,
      androidEnabled: channel.android_enabled,
      currentNativeCode: state.native?.version_code ?? null,
      currentBundleGate: state.bundle?.min_native_version ?? null,
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

interface Move {
  artefact: Artefact;
  from: Bundle | NativeBuild | undefined;
  action: ChannelAction;
}

/**
 * Moves a channel's pointers: an OTA bundle, a native build, or both at once. The native build
 * moves first, so a bundle gated on it is judged against the build it will run on. Every move is
 * checked by `canPoint`; all of them, their history rows and audit entries are written in one
 * transaction or not at all. A rollback leaves the channel accepting downgrades until the next
 * forward move.
 */
export async function pointChannel(
  deps: Deps,
  input: {
    access: AppAccess;
    principal: Principal;
    channel: Channel;
    artefacts: Artefact[];
    rollback: boolean;
    reason: string | null;
    ip: string | null;
  },
): Promise<Channel> {
  const { access, principal, channel, rollback } = input;
  requireDeliverRole(access, channel.environment, rollback ? "Rolling back" : "Delivering");
  if (input.artefacts.length === 0) throw badRequest("Nothing to deliver");
  if (new Set(input.artefacts.map((artefact) => artefact.kind)).size !== input.artefacts.length) {
    throw badRequest("Deliver at most one bundle and one native build at a time");
  }

  const ordered = [...input.artefacts].sort((a, b) =>
    a.kind === "native" ? -1 : b.kind === "native" ? 1 : 0,
  );
  const initial = await currentOf(deps, channel);
  let state = initial;
  const moves: Move[] = [];
  for (const artefact of ordered) {
    const verdict = await evaluatePointer(deps, channel, state, artefact, rollback);
    if (!verdict.ok) throw conflict(verdict.message, verdict.reason);
    const from = artefact.kind === "ota" ? state.bundle : state.native;
    if (from?.id === artefact.row.id) continue;
    moves.push({
      artefact,
      from,
      action:
        artefact.kind === "ota"
          ? rollback
            ? "rollback_bundle"
            : "point_bundle"
          : rollback
            ? "rollback_native"
            : "point_native",
    });
    state =
      artefact.kind === "ota"
        ? { ...state, bundle: artefact.row }
        : { ...state, native: artefact.row };
  }
  if (moves.length === 0) return channel;

  const updated = await deps.db.transaction().execute(async (trx) => {
    const locked = await trx
      .selectFrom("channels")
      .selectAll()
      .where("id", "=", channel.id)
      .forUpdate()
      .executeTakeFirst();
    if (!locked) throw notFound("Channel");
    if (
      locked.current_bundle_id !== (initial.bundle?.id ?? null) ||
      locked.current_native_id !== (initial.native?.id ?? null)
    ) {
      throw conflict("The channel changed while this request was in flight. Retry.", "stale");
    }

    const bundleMove = moves.find((move) => move.artefact.kind === "ota");
    const nativeMove = moves.find((move) => move.artefact.kind === "native");
    const row = await trx
      .updateTable("channels")
      .set({
        ...(bundleMove
          ? { current_bundle_id: bundleMove.artefact.row.id, allow_downgrade: rollback }
          : {}),
        ...(nativeMove ? { current_native_id: nativeMove.artefact.row.id } : {}),
        updated_at: new Date(),
      })
      .where("id", "=", channel.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    for (const move of moves) {
      await recordChannelEvent(trx, {
        channelId: channel.id,
        appId: channel.app_id,
        action: move.action,
        fromId: move.from?.id ?? null,
        toId: move.artefact.row.id,
        fromVersion: move.from?.version_name ?? null,
        toVersion: move.artefact.row.version_name,
        actorUserId: principal.userId,
        actorApiKeyId: actorColumns(principal).actor_api_key_id,
        reason: input.reason,
      });
      await writeAudit(trx, {
        organizationId: access.app.organization_id,
        appId: access.app.id,
        ...toAuditActor(principal),
        action: `channel.${move.action}`,
        targetType: "channel",
        targetId: channel.id,
        details: {
          channel: channel.name,
          from: move.from?.version_name ?? null,
          to: move.artefact.row.version_name,
          reason: input.reason,
        },
        ip: input.ip,
      });
    }
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
