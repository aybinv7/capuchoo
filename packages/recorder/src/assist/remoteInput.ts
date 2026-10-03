import type { AssistKey } from "@capuchoo/core";

export interface InputGuards {
  /** Fields matching this keep their contents from the agent. */
  maskTextSelector: string;
  /** Elements matching this are not the agent's to touch. */
  ignoreSelector: string;
  /** The assist overlay itself, which the agent must not press on the user's behalf. */
  overlay: Element | null;
}

export type InputResult = { ok: true } | { ok: false; reason: string };

const OK: InputResult = { ok: true };
const refuse = (reason: string): InputResult => ({ ok: false, reason });

const TEXT_TYPES = new Set(["text", "search", "email", "tel", "url", "number", ""]);

function textField(element: Element | null): HTMLInputElement | HTMLTextAreaElement | null {
  if (element instanceof HTMLTextAreaElement) return element;
  if (element instanceof HTMLInputElement && TEXT_TYPES.has(element.type)) return element;
  return null;
}

function guarded(element: Element, guards: InputGuards): string | null {
  if (guards.overlay?.contains(element)) return "That is the user's assist prompt.";
  if (guards.ignoreSelector && element.closest(guards.ignoreSelector)) {
    return "The app keeps this element from assist.";
  }
  return null;
}

function sealed(field: HTMLInputElement | HTMLTextAreaElement, guards: InputGuards): boolean {
  return (
    (field instanceof HTMLInputElement && field.type === "password") ||
    Boolean(guards.maskTextSelector && field.closest(guards.maskTextSelector))
  );
}

/**
 * A tap as a finger makes it: pointer, touch and mouse events at the point, then a click.
 * Framework7 reacts to the click; other code listens to any of the rest. Every event is
 * untrusted, so the recorder never takes the agent's taps for the user's steps.
 */
export function tap(x: number, y: number, guards: InputGuards): InputResult {
  const target = document.elementFromPoint(x, y);
  if (!target) return refuse("Nothing is there.");
  const blocked = guarded(target, guards);
  if (blocked) return refuse(blocked);
  const common = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y };
  const pointer = (type: string, buttons: number) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        ...common,
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        buttons,
      }),
    );
  const touch = (type: string) => {
    if (typeof Touch === "undefined" || typeof TouchEvent === "undefined") return;
    const point = new Touch({ identifier: 1, target, clientX: x, clientY: y });
    const held = type === "touchend" ? [] : [point];
    target.dispatchEvent(
      new TouchEvent(type, {
        ...common,
        touches: held,
        targetTouches: held,
        changedTouches: [point],
      }),
    );
  };
  const mouse = (type: string) =>
    target.dispatchEvent(new MouseEvent(type, { ...common, view: window, detail: 1 }));

  pointer("pointerdown", 1);
  touch("touchstart");
  pointer("pointerup", 0);
  touch("touchend");
  mouse("mousedown");
  const focusable = target.closest<HTMLElement>(
    "input, textarea, select, button, a[href], [tabindex], [contenteditable]",
  );
  focusable?.focus({ preventScroll: true });
  mouse("mouseup");
  mouse("click");
  return OK;
}

function scrollable(start: Element | null): Element {
  for (let element = start; element; element = element.parentElement) {
    const style = getComputedStyle(element);
    const canScroll =
      (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight) ||
      (/(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth);
    if (canScroll) return element;
  }
  return document.scrollingElement ?? document.documentElement;
}

/** Scrolls whatever scrolls under the point, the way a swipe there would. */
export function scroll(
  x: number,
  y: number,
  dx: number,
  dy: number,
  guards: InputGuards,
): InputResult {
  const target = document.elementFromPoint(x, y);
  if (target) {
    const blocked = guarded(target, guards);
    if (blocked) return refuse(blocked);
  }
  scrollable(target).scrollBy({ left: dx, top: dy, behavior: "instant" as ScrollBehavior });
  return OK;
}

/** Writes into the focused field through its native setter, so Vue and React hear an input. */
function writeField(
  field: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  inputType: string,
  data: string | null,
) {
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
  field.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType, data }));
}

/** Types into the focused field at the caret. Password and masked fields refuse. */
export function typeText(text: string, guards: InputGuards): InputResult {
  const field = textField(document.activeElement);
  if (!field) return refuse("No text field has focus; tap one first.");
  const blocked = guarded(field, guards);
  if (blocked) return refuse(blocked);
  if (sealed(field, guards)) return refuse("This field is private; the user types in it.");
  if (field.readOnly || field.disabled) return refuse("This field cannot be edited.");
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  writeField(
    field,
    field.value.slice(0, start) + text + field.value.slice(end),
    "insertText",
    text,
  );
  try {
    field.setSelectionRange(start + text.length, start + text.length);
  } catch {
    return OK;
  }
  return OK;
}

/** Enter submits, Backspace deletes, Tab moves on, Escape dismisses - as the keyboard would. */
export function key(name: AssistKey, guards: InputGuards): InputResult {
  const target = document.activeElement ?? document.body;
  const blocked = guarded(target, guards);
  if (blocked) return refuse(blocked);
  const field = textField(target);
  if (name === "Backspace") {
    if (!field) return refuse("No text field has focus.");
    if (sealed(field, guards)) return refuse("This field is private; the user types in it.");
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? field.value.length;
    const from = start === end ? Math.max(0, start - 1) : start;
    writeField(
      field,
      field.value.slice(0, from) + field.value.slice(end),
      "deleteContentBackward",
      null,
    );
    return OK;
  }
  const init = { key: name, code: name, bubbles: true, cancelable: true, composed: true };
  const proceed = target.dispatchEvent(new KeyboardEvent("keydown", init));
  if (name === "Enter" && proceed) {
    target.dispatchEvent(new KeyboardEvent("keypress", { ...init, charCode: 13, keyCode: 13 }));
    if (field instanceof HTMLInputElement) {
      field.dispatchEvent(new Event("change", { bubbles: true }));
      field.form?.requestSubmit?.();
    }
  }
  if (name === "Tab" && proceed) moveFocus(target);
  target.dispatchEvent(new KeyboardEvent("keyup", init));
  return OK;
}

function moveFocus(from: Element): void {
  const focusable = Array.from(
    document.querySelectorAll<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null);
  const index = focusable.indexOf(from as HTMLElement);
  focusable[(index + 1) % Math.max(1, focusable.length)]?.focus();
}
