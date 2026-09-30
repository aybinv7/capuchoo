import type { Environment } from "@capuchoo/core";

/** The facts about a channel that decide how strict a deploy to it must be. */
export interface ChannelClass {
  name: string;
  environment: Environment;
  /** Absent on servers that predate client channels; treated as `release`. */
  kind?: "release" | "client" | undefined;
}

/** Prod and client channels serve field devices: nothing unsigned or debug-signed may reach them. */
export function isProtectedChannel(channel: ChannelClass): boolean {
  return channel.environment === "prod" || channel.kind === "client";
}

/** The only channels an unsigned artefact may be published to. */
export function isDevChannel(channel: ChannelClass): boolean {
  return channel.environment === "dev" && channel.kind !== "client";
}

/** `"prod" (prod, client)` - how a channel is named in refusals. */
export function describeChannel(channel: ChannelClass): string {
  const kind = channel.kind === "client" ? ", client" : "";
  return `"${channel.name}" (${channel.environment}${kind})`;
}
