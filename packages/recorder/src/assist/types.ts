/** What the user reads. `{agent}` is replaced with the agent's name. */
export interface AssistTexts {
  title: string;
  body: string;
  allow: string;
  deny: string;
  controlTitle: string;
  controlBody: string;
  viewing: string;
  controlling: string;
  /** Shown when the user touches the app while the agent controls it. */
  shielded: string;
  stop: string;
}

export interface AssistOptions {
  /** Wording, for the app's language; anything left out stays in English. */
  texts?: Partial<AssistTexts>;
  /** Text direction of the prompts. Default: the document's. */
  dir?: "ltr" | "rtl";
  /** Lets the agent ask for control at all. Default `true`; the user is asked every time. */
  control?: boolean;
}

export const DEFAULT_TEXTS: AssistTexts = {
  title: "{agent} from support wants to see your screen",
  body: "They see this app only - not your other apps, notifications or passwords. You can stop at any time.",
  allow: "Allow",
  deny: "Not now",
  controlTitle: "{agent} asks to use the app for you",
  controlBody:
    "They will be able to tap, scroll and type in this app. They cannot type in password fields.",
  viewing: "{agent} is viewing your screen",
  controlling: "{agent} is using the app",
  shielded: "{agent} is using the app for you. Tap Stop to take it back.",
  stop: "Stop",
};

export type { LiveSocket as AssistSocketLike } from "../live/types.js";
