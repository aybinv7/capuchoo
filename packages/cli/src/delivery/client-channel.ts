import type { Environment } from "@capuchoo/core";
import type { ChannelRecord } from "../services/wire.js";

export interface ClientChannelInput {
  name: string;
  baseName: string | undefined;
  /** `--environment`, when also passed. */
  environment: Environment | undefined;
  channels: ChannelRecord[];
}

export interface ClientChannelPlan {
  environment: Environment;
  base: ChannelRecord;
}

/** Validates `channel create --client --base`: the base must be a release channel with an environment. */
export function planClientChannel(input: ClientChannelInput): ClientChannelPlan {
  if (!input.baseName) {
    throw new Error("A client channel follows a release channel. Pass --base, e.g. --base prod.");
  }

  const base = input.channels.find((channel) => channel.name === input.baseName);
  if (!base) {
    const releases = input.channels.filter((channel) => channel.kind !== "client");
    throw new Error(
      `No channel "${input.baseName}". Release channels: ${releases.map((c) => c.name).join(", ") || "none"}.`,
    );
  }

  if (base.kind === "client") {
    throw new Error(
      `"${base.name}" is itself a client channel. The base must be a release channel.`,
    );
  }

  if (!base.environment) {
    throw new Error(
      `"${base.name}" has no environment, so a channel following it would serve nothing.`,
    );
  }

  if (input.environment && input.environment !== base.environment) {
    throw new Error(
      `A client channel serves its base's environment: "${base.name}" is ${base.environment}, not ${input.environment}. Drop --environment.`,
    );
  }

  return { environment: base.environment, base };
}
