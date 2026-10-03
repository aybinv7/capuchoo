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
  stop: "Stop",
};

/** The little of a WebSocket the session uses, so tests can stand in for the network. */
export interface AssistSocketLike {
  readonly readyState: number;
  readonly bufferedAmount: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "open" | "close" | "error", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
}
