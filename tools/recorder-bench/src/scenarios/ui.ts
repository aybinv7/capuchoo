import type { CdpSession } from "../cdp/session.ts";
import type { Input } from "../device/input.ts";

export interface Spot {
  x: number;
  y: number;
}

const POLL_MS = 150;

/** Finds the first matching element that is on screen and on top at its centre, in device pixels. */
const LOCATE = (selector: string, text: string | null) => `(() => {
  const dpr = window.devicePixelRatio || 1;
  const wanted = ${JSON.stringify(text)};
  for (const element of document.querySelectorAll(${JSON.stringify(selector)})) {
    if (wanted && !(element.textContent || "").includes(wanted)) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
    const hit = document.elementFromPoint(x, y);
    if (!hit || !(element === hit || element.contains(hit) || hit.contains(element))) continue;
    return { x: x * dpr, y: y * dpr };
  }
  return null;
})()`;

export function createUi(page: CdpSession, input: Input) {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function find(selector: string, text: string | null, timeoutMs: number): Promise<Spot> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const spot = await page.evaluate<Spot | null>(LOCATE(selector, text));
      if (spot) return spot;
      if (Date.now() > deadline) {
        const why = await page
          .evaluate<string>(`(() => {
          const all = [...document.querySelectorAll(${JSON.stringify(selector)})];
          const first = all[0];
          if (!first) return "no element matches";
          const rect = first.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          const describe = (node) => node ? node.tagName.toLowerCase() + "." + String(node.className).trim().split(/\\s+/).slice(0, 3).join(".") : "nothing";
          const style = getComputedStyle(first.closest(".tab") || first);
          return all.length + " match, first " + Math.round(rect.width) + "x" + Math.round(rect.height) + " at " + Math.round(rect.top) + "px of " + innerHeight + ", tab " + (first.closest(".tab")?.className || "none") + " display " + style.display + ", covered by " + describe(hit) + " in " + describe(hit && hit.closest(".page, .sheet-modal, .popup, .panel, .toolbar"));
        })()`)
          .catch(() => "unknown");
        throw new Error(`Nothing visible matches ${selector}${text ? ` "${text}"` : ""} (${why})`);
      }
      await sleep(POLL_MS);
    }
  }

  async function viewport(): Promise<{ width: number; height: number }> {
    return page.evaluate(
      "({ width: innerWidth * (devicePixelRatio || 1), height: innerHeight * (devicePixelRatio || 1) })",
    );
  }

  return {
    sleep,
    find,

    /** Taps the element's centre; `reveal` first scrolls it into the middle of its scroller. */
    async tap(
      selector: string,
      options: { text?: string; timeoutMs?: number; reveal?: boolean } = {},
    ) {
      if (options.reveal) {
        await page.evaluate(`(() => {
          const wanted = ${JSON.stringify(options.text ?? null)};
          const element = [...document.querySelectorAll(${JSON.stringify(selector)})].find(
            (candidate) => !wanted || (candidate.textContent || "").includes(wanted),
          );
          element?.scrollIntoView({ block: "center" });
        })()`);
        await sleep(400);
      }
      const spot = await find(selector, options.text ?? null, options.timeoutMs ?? 8000);
      await input.tap(spot.x, spot.y);
    },

    /**
     * Taps until `expression` holds, at most `attempts` times: a tap that lands while the target
     * is still animating in is ignored by the app, and a person would simply tap again.
     */
    async tapUntil(
      selector: string,
      expression: string,
      options: { text?: string; attempts?: number; waitMs?: number } = {},
    ) {
      const attempts = options.attempts ?? 3;
      for (let attempt = 1; ; attempt += 1) {
        const spot = await find(selector, options.text ?? null, 8000);
        await input.tap(spot.x, spot.y);
        const deadline = Date.now() + (options.waitMs ?? 1500);
        while (Date.now() < deadline) {
          if (await page.evaluate<boolean>(`Boolean(${expression})`)) return;
          await sleep(POLL_MS);
        }
        if (attempt >= attempts) {
          throw new Error(`${expression} still false after ${attempts} taps on ${selector}`);
        }
        await sleep(400);
      }
    },

    /** Waits until an expression in the page is truthy. */
    async until(expression: string, timeoutMs: number): Promise<void> {
      const deadline = Date.now() + timeoutMs;
      while (!(await page.evaluate<boolean>(`Boolean(${expression})`))) {
        if (Date.now() > deadline) throw new Error(`Timed out waiting for ${expression}`);
        await sleep(POLL_MS * 2);
      }
    },

    /** A vertical fling in the middle of the screen; positive `fraction` scrolls the content up. */
    async scroll(fraction: number, durationMs = 280) {
      const { width, height } = await viewport();
      const x = width / 2;
      const from = height * (fraction > 0 ? 0.72 : 0.32);
      const to = from - height * fraction * 0.4;
      await input.swipe(x, from, x, to, durationMs);
    },

    async back() {
      await input.key("BACK");
    },

    async type(text: string) {
      await input.type(text);
    },

    async erase(count: number) {
      for (let index = 0; index < count; index += 1) await input.key("DEL");
    },
  };
}

export type Ui = ReturnType<typeof createUi>;
