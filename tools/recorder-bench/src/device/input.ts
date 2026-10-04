import type { Adb } from "./adb.ts";
import type { App } from "./app.ts";

/** Raised when the app is no longer in front, so the run stops instead of tapping someone's phone. */
export class NotInForeground extends Error {
  constructor() {
    super("The app under test is not in the foreground; stopping before touching the screen.");
  }
}

/**
 * Real touches through `adb input`. Framework7 ignores synthetic DOM clicks, and a real touch also
 * exercises the whole input path the recorder hooks into. Every gesture first checks that the app
 * under test is the one in front.
 */
export function createInput(adb: Adb, app: App) {
  async function guard() {
    if (!(await app.isForeground())) throw new NotInForeground();
  }
  const round = (value: number) => Math.round(value);

  return {
    async tap(x: number, y: number) {
      await guard();
      await adb.shell(`input tap ${round(x)} ${round(y)}`);
    },
    async swipe(x1: number, y1: number, x2: number, y2: number, durationMs: number) {
      await guard();
      await adb.shell(
        `input swipe ${round(x1)} ${round(y1)} ${round(x2)} ${round(y2)} ${round(durationMs)}`,
      );
    },
    /** Types ASCII text into the focused field; spaces are sent as `%s`, which `input text` needs. */
    async type(text: string) {
      if (!/^[\w .,@-]*$/.test(text)) throw new Error(`Unsupported characters in "${text}"`);
      await guard();
      await adb.shell(`input text '${text.replaceAll(" ", "%s")}'`);
    },
    async key(code: "BACK" | "DEL" | "ENTER" | "WAKEUP") {
      if (code !== "WAKEUP") await guard();
      await adb.shell(`input keyevent KEYCODE_${code}`);
    },
  };
}

export type Input = ReturnType<typeof createInput>;
