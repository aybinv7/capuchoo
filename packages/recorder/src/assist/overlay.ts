import type { AssistTexts } from "./types.js";

const STYLE = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; }
.scrim { position: absolute; inset: 0; background: rgb(0 0 0 / 0.38); pointer-events: auto; animation: fade 160ms ease-out; }
.sheet { position: absolute; left: 12px; right: 12px; bottom: max(12px, env(safe-area-inset-bottom)); margin: 0 auto; max-width: 440px;
  background: var(--surface); color: var(--text); border-radius: 20px; padding: 20px; pointer-events: auto;
  box-shadow: 0 18px 50px -12px rgb(0 0 0 / 0.45); animation: rise 200ms cubic-bezier(.2,.8,.2,1); }
.head { display: flex; align-items: center; gap: 12px; }
.avatar { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
  background: var(--accent); color: #fff; font-weight: 600; font-size: 16px; }
h2 { margin: 0; font-size: 17px; line-height: 1.3; font-weight: 600; }
p { margin: 12px 0 0; font-size: 14px; line-height: 1.5; color: var(--muted); }
.actions { display: flex; gap: 8px; margin-top: 18px; }
button { flex: 1; min-height: 44px; border-radius: 12px; border: 0; font-size: 15px; font-weight: 600; cursor: pointer; }
.primary { background: var(--accent); color: #fff; }
.secondary { background: var(--soft); color: var(--text); }
.banner { position: absolute; top: max(8px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 10px; max-width: calc(100% - 16px); padding: 6px 6px 6px 12px;
  border-radius: 999px; background: var(--banner); color: #fff; font-size: 13px; pointer-events: auto;
  box-shadow: 0 6px 20px -6px rgb(0 0 0 / 0.5); animation: drop 200ms ease-out; }
.banner span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #fff; animation: pulse 1.4s ease-in-out infinite; }
.banner button { flex: none; min-height: 30px; padding: 0 14px; border-radius: 999px; background: #fff; color: var(--banner); font-size: 13px; }
.cursor { pointer-events: none; position: absolute; left: 0; top: 0; display: flex; align-items: flex-start;
  transition: transform 80ms linear, opacity 160ms; opacity: 0; filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.35)); }
.cursor.on { opacity: 1; }
.cursor svg { width: 22px; height: 22px; margin: -2px 0 0 -3px; flex: none; }
.cursor .name { margin: 16px 0 0 -4px; padding: 2px 7px; border-radius: 999px; background: var(--accent); color: #fff;
  font-size: 11px; font-weight: 600; line-height: 16px; white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.ripple { pointer-events: none; position: absolute; width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%;
  border: 2px solid var(--accent); background: rgb(196 100 63 / 0.25); animation: ripple 450ms ease-out forwards; }
.shield { position: absolute; inset: 0; pointer-events: auto; background: transparent; touch-action: none; }
.blocked { pointer-events: none; position: absolute; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 50%;
  display: grid; place-items: center; border: 2px solid var(--banner); background: rgb(192 57 43 / 0.18); color: var(--banner);
  animation: blocked 620ms cubic-bezier(.2,.8,.2,1) forwards; }
.blocked svg { width: 22px; height: 22px; }
.banner.nudge { animation: nudge 380ms ease-in-out; }
.layer.through * { pointer-events: none !important; }
.hint { position: absolute; top: calc(max(8px, env(safe-area-inset-top)) + 52px); left: 50%; transform: translateX(-50%);
  padding: 8px 14px; border-radius: 12px; background: var(--surface); color: var(--text); font-size: 13px; line-height: 1.4;
  box-shadow: 0 8px 24px -8px rgb(0 0 0 / 0.45); max-width: calc(100% - 32px); text-align: center; animation: drop 160ms ease-out; }
.layer { --surface: #ffffff; --text: #17171a; --muted: #55565c; --soft: #eeeef1; --accent: #c4643f; --banner: #1f6f5c; }
.layer.control { --banner: #c0392b; }
@media (prefers-color-scheme: dark) {
  .layer { --surface: #1f1f23; --text: #f3f3f5; --muted: #a9aab1; --soft: #2d2d33; }
}
@keyframes fade { from { opacity: 0; } }
@keyframes rise { from { transform: translateY(24px); opacity: 0; } }
@keyframes drop { from { transform: translate(-50%, -16px); opacity: 0; } }
@keyframes pulse { 50% { opacity: 0.35; } }
@keyframes blocked { 0% { transform: scale(0.4); opacity: 0; } 20% { transform: scale(1); opacity: 1; }
  35% { transform: translateX(-5px); } 50% { transform: translateX(5px); } 65% { transform: translateX(-3px); opacity: 1; }
  100% { transform: scale(1.15); opacity: 0; } }
@keyframes nudge { 0%, 100% { transform: translateX(-50%); } 20%, 60% { transform: translateX(calc(-50% - 7px)); }
  40%, 80% { transform: translateX(calc(-50% + 7px)); } }
@keyframes ripple { from { transform: scale(0.4); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`;

const fill = (text: string, agent: string) => text.replaceAll("{agent}", agent);

const LOCK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

/** One touch fires pointer, touch and click events; they get one answer between them. */
const BLOCKED_GAP_MS = 350;

function pointOf(event: Event): { x: number; y: number } | null {
  if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  if (event instanceof MouseEvent) return { x: event.clientX, y: event.clientY };
  return null;
}

/**
 * What the user sees of assist: a sheet asking for consent, a banner while it runs with a Stop
 * that always works, and the agent's pointer. It lives in a closed shadow root, so the app's styles
 * cannot hide or restyle it, and it is blocked from the recording.
 */
export class AssistOverlay {
  readonly host: HTMLElement;
  private readonly root: ShadowRoot;
  private readonly layer: HTMLElement;
  private sheet: HTMLElement | null = null;
  private banner: HTMLElement | null = null;
  private cursor: HTMLElement | null = null;
  private shield: HTMLElement | null = null;
  private hint: HTMLElement | null = null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private lastBlocked = 0;

  constructor(
    private readonly texts: AssistTexts,
    private readonly dir: "ltr" | "rtl",
  ) {
    this.host = document.createElement("capuchoo-assist");
    this.host.setAttribute("data-capuchoo-block", "");
    this.root = this.host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    this.layer = document.createElement("div");
    this.layer.className = "layer";
    this.layer.dir = dir;
    this.root.append(style, this.layer);
    document.documentElement.append(this.host);
  }

  /** Asks the user; resolves with their answer, or `false` once `timeoutMs` passes unanswered. */
  ask(kind: "view" | "control", agent: string, timeoutMs: number): Promise<boolean> {
    this.dismissSheet();
    return new Promise((resolve) => {
      const scrim = document.createElement("div");
      scrim.className = "scrim";
      const sheet = document.createElement("section");
      sheet.className = "sheet";
      sheet.setAttribute("role", "alertdialog");
      sheet.setAttribute("aria-modal", "true");
      const title = kind === "view" ? this.texts.title : this.texts.controlTitle;
      const body = kind === "view" ? this.texts.body : this.texts.controlBody;

      const head = document.createElement("div");
      head.className = "head";
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = agent.trim().charAt(0).toUpperCase() || "?";
      const heading = document.createElement("h2");
      heading.id = "assist-title";
      heading.textContent = fill(title, agent);
      head.append(avatar, heading);
      const text = document.createElement("p");
      text.textContent = fill(body, agent);
      sheet.setAttribute("aria-labelledby", "assist-title");

      const actions = document.createElement("div");
      actions.className = "actions";
      const deny = document.createElement("button");
      deny.className = "secondary";
      deny.textContent = this.texts.deny;
      const allow = document.createElement("button");
      allow.className = "primary";
      allow.textContent = this.texts.allow;
      actions.append(deny, allow);
      sheet.append(head, text, actions);

      const wrapper = document.createElement("div");
      wrapper.append(scrim, sheet);
      this.layer.append(wrapper);
      this.sheet = wrapper;

      let settled = false;
      const settle = (answer: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.sheet === wrapper) this.dismissSheet();
        resolve(answer);
      };
      const timer = setTimeout(() => settle(false), Math.max(0, timeoutMs));
      allow.addEventListener("click", () => settle(true));
      deny.addEventListener("click", () => settle(false));
      scrim.addEventListener("click", () => settle(false));
      allow.focus({ preventScroll: true });
    });
  }

  dismissSheet(): void {
    this.sheet?.remove();
    this.sheet = null;
  }

  /** The banner that stays while the agent watches or drives, with the user's way out. */
  showBanner(state: "viewing" | "controlling", agent: string, onStop: () => void): void {
    this.banner?.remove();
    this.layer.classList.toggle("control", state === "controlling");
    const banner = document.createElement("div");
    banner.className = "banner";
    banner.setAttribute("role", "status");
    const dot = document.createElement("i");
    dot.className = "dot";
    const label = document.createElement("span");
    label.textContent = fill(
      state === "viewing" ? this.texts.viewing : this.texts.controlling,
      agent,
    );
    const stop = document.createElement("button");
    stop.textContent = this.texts.stop;
    stop.addEventListener("click", onStop);
    banner.append(dot, label, stop);
    this.layer.append(banner);
    this.banner = banner;
  }

  /** The agent's cursor: an arrow with their name, its tip on the point. */
  pointer(x: number, y: number, agent: string): void {
    if (!this.cursor) {
      const cursor = document.createElement("div");
      cursor.className = "cursor";
      cursor.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2v17.5l4.6-4.4 3.3 7.2 3.2-1.4-3.3-7.1H18z" fill="var(--accent)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      const name = document.createElement("span");
      name.className = "name";
      cursor.append(name);
      this.layer.append(cursor);
      this.cursor = cursor;
    }
    const name = this.cursor.querySelector(".name");
    if (name && name.textContent !== agent) name.textContent = agent;
    this.cursor.style.transform = `translate(${x}px, ${y}px)`;
    this.cursor.classList.add("on");
  }

  hidePointer(): void {
    this.cursor?.classList.remove("on");
  }

  /** A ripple where the agent tapped, so the user sees each tap land. */
  ripple(x: number, y: number): void {
    const ripple = document.createElement("i");
    ripple.className = "ripple";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    this.layer.append(ripple);
    setTimeout(() => ripple.remove(), 1000);
  }

  /**
   * While the agent controls the app, the user's own touches stop at a transparent shield - two
   * hands on one screen fight each other. A stopped touch answers where it landed with a shaking
   * lock, nudges the banner whose Stop takes control back, and says so; `onBlocked` hears it too.
   * Stop, in the banner above the shield, always works.
   */
  shieldUser(on: boolean, hint: string, onBlocked?: (x: number, y: number) => void): void {
    if (!on) {
      this.shield?.remove();
      this.shield = null;
      return;
    }
    if (this.shield) return;
    const shield = document.createElement("div");
    shield.className = "shield";
    const show = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      if (now - this.lastBlocked < BLOCKED_GAP_MS) return;
      this.lastBlocked = now;
      const at = pointOf(event);
      if (at) {
        this.blockedAt(at.x, at.y);
        onBlocked?.(Math.round(at.x), Math.round(at.y));
      }
      this.nudgeBanner();
      this.showHint(hint);
      try {
        navigator.vibrate?.(30);
      } catch {
        return;
      }
    };
    shield.addEventListener("pointerdown", show);
    shield.addEventListener("touchstart", show, { passive: false });
    shield.addEventListener("click", show);
    this.layer.prepend(shield);
    this.shield = shield;
  }

  private blockedAt(x: number, y: number): void {
    const mark = document.createElement("i");
    mark.className = "blocked";
    mark.innerHTML = LOCK;
    mark.style.left = `${x}px`;
    mark.style.top = `${y}px`;
    mark.addEventListener("animationend", () => mark.remove(), { once: true });
    this.layer.append(mark);
    setTimeout(() => mark.remove(), 1000);
  }

  private nudgeBanner(): void {
    const banner = this.banner;
    if (!banner) return;
    banner.classList.remove("nudge");
    void banner.offsetWidth;
    banner.classList.add("nudge");
  }

  private showHint(text: string): void {
    if (!this.hint) {
      this.hint = document.createElement("div");
      this.hint.className = "hint";
      this.hint.setAttribute("role", "status");
      this.layer.append(this.hint);
    }
    this.hint.textContent = text;
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => {
      this.hint?.remove();
      this.hint = null;
    }, 2500);
  }

  /**
   * Runs the agent's input with the whole overlay out of the way - shield, banner and hint - so a
   * tap the agent aims at the app under the banner reaches it; the agent cannot see the banner and
   * cannot press its Stop. Nothing else runs in between, the dispatch being synchronous.
   */
  passThrough<T>(run: () => T): T {
    this.layer.classList.add("through");
    try {
      return run();
    } finally {
      this.layer.classList.remove("through");
    }
  }

  destroy(): void {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.host.remove();
  }

  get direction(): "ltr" | "rtl" {
    return this.dir;
  }
}
