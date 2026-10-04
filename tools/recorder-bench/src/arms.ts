import type { McpClient } from "./server/mcp.ts";

export const ARM_NAMES = ["absent", "off", "buffer", "session"] as const;
export type ArmName = (typeof ARM_NAMES)[number];

export interface Arm {
  name: ArmName;
  /** What the testbed's bench hook reads before startup: `absent` never loads the recorder. */
  local: "absent" | "present";
  /** The device rule the server sends; every field an arm depends on is set, never inherited. */
  policy: Record<string, unknown>;
  /** The mode the recorder must report once its policy is in, or null when it is not loaded. */
  expectedMode: string | null;
}

const OFF = { mode: "off", ceiling: "off", triggers: [], sampleRate: 1 };

export const ARMS: Record<ArmName, Arm> = {
  absent: { name: "absent", local: "absent", policy: OFF, expectedMode: null },
  off: { name: "off", local: "present", policy: OFF, expectedMode: "off" },
  buffer: {
    name: "buffer",
    local: "present",
    policy: {
      mode: "buffer",
      ceiling: "session",
      triggers: ["error", "shake", "manual", "app"],
      sampleRate: 1,
    },
    expectedMode: "buffer",
  },
  session: {
    name: "session",
    local: "present",
    policy: {
      mode: "session",
      ceiling: "session",
      triggers: ["error", "shake", "manual", "app"],
      sampleRate: 1,
    },
    expectedMode: "session",
  },
};

export function parseArms(value: string): ArmName[] {
  const names = value.split(",").map((name) => name.trim());
  for (const name of names) {
    if (!(ARM_NAMES as readonly string[]).includes(name)) throw new Error(`Unknown arm "${name}"`);
  }
  return names as ArmName[];
}

/** Puts the device's recording rule in place for an arm; one MCP call, audited on the server. */
export async function applyArmRule(
  mcp: McpClient,
  target: { app: string; deviceId: string },
  arm: Arm,
): Promise<void> {
  await mcp.call("set_recording_rule", {
    app: target.app,
    scope: "device",
    target: target.deviceId,
    policy: arm.policy,
  });
}
