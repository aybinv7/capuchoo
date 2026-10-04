import type { AppRole } from "@capuchoo/core";
import { requireApp, type AppAccess } from "../access/app-access";
import { actorColumns, type Principal } from "../auth/principal";
import type { Channel, Device } from "../db/schema";
import type { Deps } from "../http/context";
import { HttpError, notFound } from "../lib/errors";
import { isUuid } from "../repositories/apps";
import { writeAudit } from "../repositories/audit";
import { findChannel, findChannelByName } from "../repositories/channels";
import { findDevice, findDeviceById } from "../repositories/devices";

/** Who is calling, through which key and from where: what every tool works on behalf of. */
export interface ToolContext {
  deps: Deps;
  principal: Principal;
  ip: string | null;
}

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** Compact JSON: the model reads every byte of it. */
export const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
});

export const failed = (message: string, reason: string): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify({ error: message, reason }) }],
  isError: true,
});

/**
 * Runs a tool body and turns what it throws into a tool error the model can act on: the server's
 * own refusals keep their message and reason, a malformed id reads as not found, and anything else
 * is logged and reported without its internals.
 */
export function guarded<A>(ctx: ToolContext, tool: string, body: (args: A) => Promise<unknown>) {
  return async (args: A): Promise<ToolResult> => {
    try {
      return ok(await body(args));
    } catch (error) {
      if (error instanceof HttpError) return failed(error.message, error.reason ?? "error");
      if ((error as { code?: unknown })?.code === "22P02") return failed("Not found", "not_found");
      ctx.deps.logger.error("mcp tool failed", { tool, error });
      return failed("The tool failed on the server; nothing was changed.", "internal");
    }
  };
}

export const appAccess = (ctx: ToolContext, app: string, minimum: AppRole, action: string) =>
  requireApp(ctx.deps.db, ctx.principal, app, minimum, action);

/** A channel by id, or by name within an app. */
export async function resolveChannel(
  ctx: ToolContext,
  input: { app?: string | undefined; channel: string },
  minimum: AppRole,
  action: string,
): Promise<{ access: AppAccess; channel: Channel }> {
  if (isUuid(input.channel)) {
    const channel = await findChannel(ctx.deps.db, input.channel);
    if (!channel) throw notFound("Channel");
    return { access: await appAccess(ctx, channel.app_id, minimum, action), channel };
  }
  if (!input.app) throw notFound("Channel");
  const access = await appAccess(ctx, input.app, minimum, action);
  const channel = await findChannelByName(ctx.deps.db, access.app.id, input.channel);
  if (!channel) throw notFound("Channel");
  return { access, channel };
}

/** A device by its id here, or by the id the device reports within an app. */
export async function resolveDevice(
  ctx: ToolContext,
  input: { app?: string | undefined; device: string },
  minimum: AppRole,
  action: string,
): Promise<{ access: AppAccess; device: Device }> {
  if (isUuid(input.device)) {
    const device = await findDeviceById(ctx.deps.db, input.device);
    if (device) return { access: await appAccess(ctx, device.app_id, minimum, action), device };
  }
  if (!input.app) throw notFound("Device");
  const access = await appAccess(ctx, input.app, minimum, action);
  const device = await findDevice(ctx.deps.db, access.app.id, input.device);
  if (!device) throw notFound("Device");
  return { access, device };
}

/** Every write an agent makes is in the audit log, marked as having come through MCP. */
export function audit(
  ctx: ToolContext,
  access: AppAccess,
  entry: {
    action: string;
    targetType: string;
    targetId?: string;
    details?: Record<string, unknown>;
  },
) {
  const actor = actorColumns(ctx.principal);
  return writeAudit(ctx.deps.db, {
    organizationId: access.app.organization_id,
    appId: access.app.id,
    actorUserId: actor.actor_user_id,
    actorApiKeyId: actor.actor_api_key_id,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    details: { ...entry.details, via: "mcp" },
    ip: ctx.ip,
  });
}

export const iso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;
