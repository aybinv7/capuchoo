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
.pointer { pointer-events: none; position: absolute; left: 0; top: 0; width: 28px; height: 28px; margin: -14px 0 0 -14px; border-radius: 50%;
  border: 3px solid var(--accent); background: rgb(255 255 255 / 0.25); box-shadow: 0 0 0 4px rgb(0 0 0 / 0.15);
  transition: transform 90ms linear, opacity 160ms; opacity: 0; }
.pointer.on { opacity: 1; }
.pointer.tap { animation: tap 380ms ease-out; }
.layer { --surface: #ffffff; --text: #17171a; --muted: #55565c; --soft: #eeeef1; --accent: #c4643f; --banner: #1f6f5c; }
.layer.control { --banner: #c0392b; }
@media (prefers-color-scheme: dark) {
  .layer { --surface: #1f1f23; --text: #f3f3f5; --muted: #a9aab1; --soft: #2d2d33; }
}
@keyframes fade { from { opacity: 0; } }
@keyframes rise { from { transform: translateY(24px); opacity: 0; } }
@keyframes drop { from { transform: translate(-50%, -16px); opacity: 0; } }
@keyframes pulse { 50% { opacity: 0.35; } }
@keyframes tap { 40% { box-shadow: 0 0 0 14px rgb(196 100 63 / 0.25); } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`;

const fill = (text: string, agent: string) => text.replaceAll("{agent}", agent);

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
  private pointerDot: HTMLElement | null = null;

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

  pointer(x: number, y: number, tapped = false): void {
    if (!this.pointerDot) {
      this.pointerDot = document.createElement("i");
      this.pointerDot.className = "pointer";
      this.layer.append(this.pointerDot);
    }
    const dot = this.pointerDot;
    dot.style.transform = `translate(${x}px, ${y}px)`;
    dot.classList.add("on");
    if (tapped) {
      dot.classList.remove("tap");
      void dot.offsetWidth;
      dot.classList.add("tap");
    }
  }

  hidePointer(): void {
    this.pointerDot?.classList.remove("on");
  }

  destroy(): void {
    this.host.remove();
  }

  get direction(): "ltr" | "rtl" {
    return this.dir;
  }
}
