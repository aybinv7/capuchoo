import {
  RECORDING_LIMITS,
  RECORDING_RULE_SCOPES,
  normaliseRecordingPatch,
  type RecordingRuleScope,
} from "@capuchoo/core";
import type { AppAccess } from "../access/app-access";
import { actorColumns, type Principal } from "../auth/principal";
import type { Deps } from "../http/context";
import { badRequest, notFound } from "../lib/errors";
import { isUuid } from "../repositories/apps";
import { writeAudit } from "../repositories/audit";
import { findChannel } from "../repositories/channels";
import { findDeviceById } from "../repositories/devices";
import { findRule, saveRule } from "../repositories/recording-rules";

export interface RuleChange {
  scope: unknown;
  channelId?: unknown;
  deviceId?: unknown;
  /** Omitted keeps an existing rule's policy. */
  policy?: unknown;
  /** Null clears the live window, omitted keeps it, a number of minutes opens one from now. */
  liveMinutes?: unknown;
}

/**
 * Creates or updates the rule for an app, a channel or a device: validates the target belongs to
 * the app, normalises the policy, sets the live window, and tells devices waiting on the policy.
 * The HTTP route and the MCP tool both come here, so they cannot drift apart.
 */
export async function changeRecordingRule(
  deps: Deps,
  input: {
    access: AppAccess;
    principal: Principal;
    ip: string | null;
    change: RuleChange;
    auditDetails?: Record<string, unknown>;
  },
) {
  const { access, change } = input;
  const scope = change.scope as RecordingRuleScope;
  if (!RECORDING_RULE_SCOPES.includes(scope))
    throw badRequest("scope must be app, channel or device");

  let channelId: string | null = null;
  let deviceUuid: string | null = null;
  if (scope === "channel") {
    const id = typeof change.channelId === "string" ? change.channelId : "";
    const channel = isUuid(id) ? await findChannel(deps.db, id) : undefined;
    if (!channel || channel.app_id !== access.app.id) throw notFound("Channel");
    channelId = channel.id;
  }
  if (scope === "device") {
    const id = typeof change.deviceId === "string" ? change.deviceId : "";
    const device = isUuid(id) ? await findDeviceById(deps.db, id) : undefined;
    if (!device || device.app_id !== access.app.id) throw notFound("Device");
    deviceUuid = device.id;
  }

  const { patch, dropped } = normaliseRecordingPatch(change.policy ?? {});
  const target = { appId: access.app.id, scope, channelId, deviceUuid };
  const existing = await findRule(deps.db, target);
  const now = deps.now();

  let liveUntil = existing?.live_until ?? null;
  if (change.liveMinutes === null) liveUntil = null;
  else if (change.liveMinutes !== undefined) {
    const minutes = Number(change.liveMinutes);
    const { min, max } = RECORDING_LIMITS.liveMinutes;
    if (!Number.isFinite(minutes) || minutes < min || minutes > max) {
      throw badRequest(`live_minutes must be between ${min} and ${max}`);
    }
    liveUntil = new Date(now.getTime() + Math.round(minutes) * 60_000);
  }

  const rule = await saveRule(deps.db, {
    ...target,
    policy: change.policy === undefined && existing ? existing.policy : patch,
    liveUntil,
    updatedBy: input.principal.userId,
    now,
  });
  deps.cache.invalidate(`app:${access.app.id}`);
  deps.hub.publish({
    type: "recording_rule",
    appId: access.app.id,
    data: { id: rule.id, scope, channel_id: channelId, device_uuid: deviceUuid },
  });
  const actor = actorColumns(input.principal);
  await writeAudit(deps.db, {
    organizationId: access.app.organization_id,
    appId: access.app.id,
    actorUserId: actor.actor_user_id,
    actorApiKeyId: actor.actor_api_key_id,
    action: existing ? "recording_rule.update" : "recording_rule.create",
    targetType: "recording_rule",
    targetId: rule.id,
    details: {
      scope,
      channel_id: channelId,
      device_uuid: deviceUuid,
      live_until: liveUntil?.toISOString() ?? null,
      ...input.auditDetails,
    },
    ip: input.ip,
  });
  return { rule, dropped };
}
