export type ChannelId = "prod" | "prod-acme" | "prod-nova";

export interface ChannelState {
  version: string;
  changed?: boolean;
  refused?: string;
}

export interface ChannelStep {
  title: string;
  command: string;
  note: string;
  channels: Readonly<Record<ChannelId, ChannelState>>;
}

/**
 * One customer gets a fix first, another later with everything since. The fourth step is the
 * refusal `canPoint` answers when a client channel asks for a release its base never served.
 */
export const CHANNEL_STEPS: readonly ChannelStep[] = [
  {
    title: "Everyone on 1.4.2",
    command: "capuchoo channel list",
    note: "prod is the release line. Each customer has a client channel that follows it.",
    channels: {
      prod: { version: "1.4.2" },
      "prod-acme": { version: "1.4.2" },
      "prod-nova": { version: "1.4.2" },
    },
  },
  {
    title: "Acme's fix reaches prod",
    command: "capuchoo channel point prod --version 1.4.3",
    note: "Devices on client channels do not move: they follow their own pointer.",
    channels: {
      prod: { version: "1.4.3", changed: true },
      "prod-acme": { version: "1.4.2" },
      "prod-nova": { version: "1.4.2" },
    },
  },
  {
    title: "Only Acme updates",
    command: "capuchoo channel point prod-acme --version 1.4.3",
    note: "Acme's tablets take 1.4.3 on their next check. Nova is not disturbed.",
    channels: {
      prod: { version: "1.4.3" },
      "prod-acme": { version: "1.4.3", changed: true },
      "prod-nova": { version: "1.4.2" },
    },
  },
  {
    title: "No skipping the line",
    command: "capuchoo channel point prod-nova --version 1.4.4",
    note: "Refused: prod has never served 1.4.4. No customer runs a release your prod line skipped.",
    channels: {
      prod: { version: "1.4.3" },
      "prod-acme": { version: "1.4.3" },
      "prod-nova": { version: "1.4.2", refused: "1.4.4 not served by prod" },
    },
  },
  {
    title: "Nova gets everything at once",
    command: "capuchoo channel point prod-nova --version 1.4.4",
    note: "After prod serves 1.4.4, Nova jumps from 1.4.2 straight to it: Acme's fix plus its own, in one update.",
    channels: {
      prod: { version: "1.4.4", changed: true },
      "prod-acme": { version: "1.4.3" },
      "prod-nova": { version: "1.4.4", changed: true },
    },
  },
];
