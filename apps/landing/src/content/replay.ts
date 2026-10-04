import {
  Bug,
  Database,
  Headset,
  Monitor,
  Network,
  SquareTerminal,
  TestTubeDiagonal,
  type LucideIcon,
} from "@lucide/vue";

export interface RecordingMode {
  id: "off" | "buffer" | "session" | "live";
  label: string;
  figure: string;
  claim: string;
  detail: string;
}

/** What a rule can ask a device to do, from nothing to streaming. The figures are the defaults. */
export const MODES: readonly RecordingMode[] = [
  {
    id: "off",
    label: "Off",
    figure: "0 bytes",
    claim: "Nothing recorded",
    detail: "Where every app starts. Recording is a rule you write, never a default you forget.",
  },
  {
    id: "buffer",
    label: "Buffer",
    figure: "last 5 min",
    claim: "Kept on the phone",
    detail:
      "Nothing is uploaded until an error, a shake or a report. Then the minutes before it go up, and two more after.",
  },
  {
    id: "session",
    label: "Session",
    figure: "every 5 s",
    claim: "Uploaded in segments",
    detail:
      "The whole session, for a staging channel, one customer's tablets or a single device you are chasing.",
  },
  {
    id: "live",
    label: "Live",
    figure: "every 50 ms",
    claim: "Streamed to a viewer",
    detail:
      "Watch a device while it is used, a fraction of a second behind, for as long as you set.",
  },
];

export interface Track {
  name: string;
  icon: LucideIcon;
  kept: string;
  never: string;
}

/** What each part of a recording holds, and what the recorder refuses to take. */
export const TRACKS: readonly Track[] = [
  {
    name: "Screen",
    icon: Monitor,
    kept: "Every change to the page, each tap and scroll",
    never: "Passwords, and any field you mark",
  },
  {
    name: "Console",
    icon: SquareTerminal,
    kept: "Logs, warnings and uncaught errors with their stack",
    never: "Anything from other apps or the system",
  },
  {
    name: "Network",
    icon: Network,
    kept: "Method, URL, status and timing of every request",
    never: "Authorization headers and cookies; bodies stay off",
  },
  {
    name: "Database",
    icon: Database,
    kept: "The SQLite rows at the start, then each committed write",
    never: "Tables you leave out",
  },
];

export interface Capability {
  id: "assist" | "errors" | "tests";
  icon: LucideIcon;
  title: string;
  accent: string;
  description: string;
}

export const CAPABILITIES: readonly Capability[] = [
  {
    id: "assist",
    icon: Headset,
    title: "Assist,",
    accent: "with their say-so.",
    description:
      "See the user's screen live and point with a cursor that has your name on it. Once they allow it, tap and type for them; their own touches pause while you drive, and Stop always works.",
  },
  {
    id: "errors",
    icon: Bug,
    title: "Errors grouped,",
    accent: "regressions called out.",
    description:
      "Every uncaught error, grouped across sessions and versions, with the replay of the moment it happened. One that comes back after a fix is flagged, and so is a release whose sessions break more than the last.",
  },
  {
    id: "tests",
    icon: TestTubeDiagonal,
    title: "A session",
    accent: "becomes a test.",
    description:
      "The taps and inputs export as a Cypress or Playwright test, a Chrome Recorder file or a Capubridge flow, with every selector checked to match one element.",
  },
];

/** What the Cypress export wrote for the session on the replay screenshot. */
export const EXPORTED_TEST = `cy.viewport(412, 892);
cy.visit("/orders/new");
cy.contains("button", "Snacks").click();
cy.get("#code").clear().type("VIP10");
cy.get("#apply").click();`;
