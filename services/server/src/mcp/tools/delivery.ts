import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { requireDeliverRole, type AppAccess } from "../../access/app-access";
import type { Channel } from "../../db/schema";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors";
import { findBundleByVersion, findNativeByCode } from "../../repositories/artefacts";
import { channelHealth } from "../../repositories/device-events";
import {
  currentOf,
  evaluatePointer,
  pointChannel,
  setChannelPaused,
  type Artefact,
} from "../../services/delivery";
import { channelArg, channelNameArg, confirmationArg, optionalApp, reasonArg } from "../args";
import { checkConfirmation, issueConfirmation } from "../confirmation";
import { guarded, resolveChannel, type ToolContext } from "../context";

const MOVE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const CONFIRM_HOW =
  "Call it once without `confirmation` to get a preview of what changes and a confirmation token; show the preview to the user, then call again with the same arguments and the token (and, for a production channel, `confirm_channel_name`). The token is valid for 5 minutes and only for these exact arguments.";

interface Confirmable {
  confirmation?: string;
  confirm_channel_name?: string;
}

const describe = (artefact: Artefact | undefined) =>
  artefact
    ? artefact.kind === "ota"
      ? {
          kind: "ota",
          id: artefact.row.id,
          version: artefact.row.version_name,
          flavour: artefact.row.flavour,
        }
      : {
          kind: "native",
          id: artefact.row.id,
          version: artefact.row.version_name,
          version_code: artefact.row.version_code,
          flavour: artefact.row.flavour,
        }
    : null;

async function devicesOn(ctx: ToolContext, access: AppAccess, channel: Channel) {
  const health = await channelHealth(ctx.deps.db, access.app.id, ctx.deps.now());
  const row = health.find((entry) => entry.channel_id === channel.id);
  return { devices: row?.devices ?? 0, active_24h: row?.active_24h ?? 0 };
}

/**
 * The confirmation gate every device-facing move passes: without a token it answers with the
 * preview and a token; with one, it checks the token against this caller and these arguments,
 * and for production the channel's name typed out.
 */
function gate(
  ctx: ToolContext,
  action: string,
  channel: Channel,
  subject: Record<string, unknown>,
  args: Confirmable,
): { proceed: true } | { proceed: false; confirmation: { token: string; expires_at: string } } {
  const who = {
    userId: ctx.principal.userId,
    keyId: ctx.principal.credential.type === "api_key" ? ctx.principal.credential.keyId : null,
    action,
    args: subject,
  };
  const now = ctx.deps.now();
  if (!args.confirmation) {
    return {
      proceed: false,
      confirmation: issueConfirmation(ctx.deps.config.SECRET_KEY, who, now),
    };
  }
  const check = checkConfirmation(ctx.deps.config.SECRET_KEY, args.confirmation, who, now);
  if (check === "expired")
    throw conflict("The confirmation expired; ask for a new preview.", "confirmation_expired");
  if (check !== "valid") {
    throw forbidden(
      "That confirmation is for another change or another caller; ask for a new preview.",
      "confirmation_mismatch",
    );
  }
  if (channel.environment === "prod" && args.confirm_channel_name !== channel.name) {
    throw forbidden(
      `This is a production channel: confirm_channel_name must be exactly "${channel.name}".`,
      "confirm_channel_name",
    );
  }
  return { proceed: true };
}

async function artefactsFor(
  ctx: ToolContext,
  access: AppAccess,
  channel: Channel,
  args: { version?: string; version_code?: number; platform: string },
): Promise<Artefact[]> {
  const artefacts: Artefact[] = [];
  if (args.version_code !== undefined) {
    const row = await findNativeByCode(
      ctx.deps.db,
      access.app.id,
      args.platform,
      channel.environment,
      args.version_code,
    );
    if (!row) throw notFound(`Native build ${args.version_code} for ${channel.environment}`);
    artefacts.push({ kind: "native", row });
  }
  if (args.version) {
    const row = await findBundleByVersion(ctx.deps.db, access.app.id, args.platform, args.version);
    if (!row) throw notFound(`Bundle ${args.version}`);
    artefacts.push({ kind: "ota", row });
  }
  if (artefacts.length === 0)
    throw badRequest(
      "Name what to deliver: `version` for a web bundle, `version_code` for a native build, or both.",
    );
  return artefacts;
}

interface MoveArgs extends Confirmable {
  app?: string;
  channel: string;
  version?: string;
  version_code?: number;
  platform: "android" | "ios";
  reason: string;
}

async function move(
  ctx: ToolContext,
  action: "deliver_release" | "rollback_channel",
  args: MoveArgs,
) {
  const rollback = action === "rollback_channel";
  const { access, channel } = await resolveChannel(
    ctx,
    args,
    "developer",
    rollback ? "Rolling back" : "Delivering",
  );
  requireDeliverRole(access, channel.environment, rollback ? "Rolling back" : "Delivering");
  const artefacts = await artefactsFor(ctx, access, channel, args);
  const state = await currentOf(ctx.deps, channel);
  const native = artefacts.find((artefact) => artefact.kind === "native");
  const ota = artefacts.find((artefact) => artefact.kind === "ota");
  const verdicts = await Promise.all(
    artefacts.map((artefact) =>
      evaluatePointer(
        ctx.deps,
        channel,
        artefact.kind === "ota" && native?.kind === "native"
          ? { ...state, native: native.row }
          : state,
        artefact,
        rollback,
      ),
    ),
  );
  const serving = artefacts.every((artefact) =>
    artefact.kind === "ota"
      ? channel.current_bundle_id === artefact.row.id
      : channel.current_native_id === artefact.row.id,
  );
  if (serving) {
    return {
      done: true,
      changed: false,
      channel: channel.name,
      note: "The channel already serves this; nothing to do.",
    };
  }
  const refused = verdicts.find((verdict) => !verdict.ok);
  const subject = {
    channel: channel.id,
    ota: ota?.row.id ?? null,
    native: native?.row.id ?? null,
    rollback,
    reason: args.reason,
  };
  const step = refused ? null : gate(ctx, action, channel, subject, args);
  if (refused && !refused.ok) {
    return { refused: true, reason: refused.reason, message: refused.message };
  }
  if (step && !step.proceed) {
    return {
      preview: {
        action: rollback ? "roll back" : "deliver",
        channel: channel.name,
        environment: channel.environment,
        from: {
          ota: state.bundle?.version_name ?? null,
          native: state.native
            ? `${state.native.version_name} (${state.native.version_code})`
            : null,
        },
        to: { ota: describe(ota), native: describe(native) },
        reach: await devicesOn(ctx, access, channel),
        reason: args.reason,
        needs_channel_name: channel.environment === "prod",
      },
      confirmation: step.confirmation.token,
      expires_at: step.confirmation.expires_at,
      next: "Show this to the user. If they agree, call again with the same arguments plus `confirmation`.",
    };
  }
  const updated = await pointChannel(ctx.deps, {
    access,
    principal: ctx.principal,
    channel,
    artefacts,
    rollback,
    reason: args.reason,
    ip: ctx.ip,
  });
  return {
    done: true,
    channel: updated.name,
    now_serving: {
      ota: describe(ota)?.version ?? state.bundle?.version_name ?? null,
      native: describe(native),
    },
  };
}

async function pause(
  ctx: ToolContext,
  paused: boolean,
  args: Confirmable & { app?: string; channel: string; reason: string },
) {
  const action = paused ? "pause_channel" : "resume_channel";
  const { access, channel } = await resolveChannel(
    ctx,
    args,
    "developer",
    paused ? "Pausing" : "Resuming",
  );
  requireDeliverRole(access, channel.environment, paused ? "Pausing" : "Resuming");
  if (channel.paused === paused)
    return { done: true, channel: channel.name, paused, changed: false };
  const step = gate(
    ctx,
    action,
    channel,
    { channel: channel.id, paused, reason: args.reason },
    args,
  );
  if (!step.proceed) {
    return {
      preview: {
        action: paused ? "pause" : "resume",
        channel: channel.name,
        environment: channel.environment,
        effect: paused
          ? "Devices on this channel stop receiving updates until it is resumed."
          : "Devices on this channel get its current release again on their next check.",
        reach: await devicesOn(ctx, access, channel),
        reason: args.reason,
        needs_channel_name: channel.environment === "prod",
      },
      confirmation: step.confirmation.token,
      expires_at: step.confirmation.expires_at,
      next: "Show this to the user. If they agree, call again with the same arguments plus `confirmation`.",
    };
  }
  const updated = await setChannelPaused(ctx.deps, {
    access,
    principal: ctx.principal,
    channel,
    paused,
    reason: args.reason,
    ip: ctx.ip,
  });
  return { done: true, channel: updated.name, paused: updated.paused, changed: true };
}

const moveInput = {
  app: optionalApp,
  channel: channelArg,
  version: z.string().max(50).optional().describe("The web bundle's version, e.g. 1.9.2."),
  version_code: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("The native build's version code, e.g. 190."),
  platform: z.enum(["android", "ios"]).default("android"),
  reason: reasonArg,
  confirmation: confirmationArg,
  confirm_channel_name: channelNameArg,
};

const pauseInput = {
  app: optionalApp,
  channel: channelArg,
  reason: reasonArg,
  confirmation: confirmationArg,
  confirm_channel_name: channelNameArg,
};

export function registerDeliveryTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "deliver_release",
    {
      title: "Deliver a release to a channel",
      description: `Points a channel at a web bundle, a native build, or both, so its devices take it on their next check. The server applies every guard the dashboard does: flavour, native gate, a client channel only taking what its base served, no downgrade without a rollback, and the production role. ${CONFIRM_HOW}`,
      inputSchema: moveInput,
      annotations: MOVE,
    },
    guarded(ctx, "deliver_release", (args: MoveArgs) => move(ctx, "deliver_release", args)),
  );

  server.registerTool(
    "rollback_channel",
    {
      title: "Roll a channel back",
      description: `Points a channel back at an earlier web bundle or native build, which devices then install even though it is older. ${CONFIRM_HOW}`,
      inputSchema: moveInput,
      annotations: MOVE,
    },
    guarded(ctx, "rollback_channel", (args: MoveArgs) => move(ctx, "rollback_channel", args)),
  );

  server.registerTool(
    "pause_channel",
    {
      title: "Pause a channel",
      description: `Stops a channel from serving updates, for example while a bad release is investigated. ${CONFIRM_HOW}`,
      inputSchema: pauseInput,
      annotations: MOVE,
    },
    guarded(
      ctx,
      "pause_channel",
      (args: Confirmable & { app?: string; channel: string; reason: string }) =>
        pause(ctx, true, args),
    ),
  );

  server.registerTool(
    "resume_channel",
    {
      title: "Resume a channel",
      description: `Lets a paused channel serve its current release again. ${CONFIRM_HOW}`,
      inputSchema: pauseInput,
      annotations: MOVE,
    },
    guarded(
      ctx,
      "resume_channel",
      (args: Confirmable & { app?: string; channel: string; reason: string }) =>
        pause(ctx, false, args),
    ),
  );
}
