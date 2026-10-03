import type { RecordedStep } from "@capuchoo/core";
import { describeTarget } from "./describe-target.js";

export interface StepWatchOptions {
  maskAllInputs: boolean;
  maskTextSelector: string;
  ignoreSelector: string;
  /** Whether an event came from the user. Tests replace it; the browser's flag is the default. */
  trusted?: (event: Event) => boolean;
}

/** What a tap is about: the control around the touched node, or the node itself. */
const CONTROL =
  "a,button,input,select,textarea,label,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=radio],[role=switch],[role=option],[onclick],[tabindex]";
/** Inputs whose change is the step, so tapping them is not one of its own. */
const TOGGLES = new Set(["checkbox", "radio"]);
const TEXT_LIKE = new Set([
  "text",
  "search",
  "email",
  "tel",
  "url",
  "number",
  "password",
  "date",
  "datetime-local",
  "time",
  "month",
  "week",
]);

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const isField = (node: unknown): node is Field =>
  node instanceof HTMLInputElement ||
  node instanceof HTMLTextAreaElement ||
  node instanceof HTMLSelectElement;

const isTextField = (node: Element): node is HTMLInputElement | HTMLTextAreaElement =>
  node instanceof HTMLTextAreaElement ||
  (node instanceof HTMLInputElement && TEXT_LIKE.has(node.type));

/** A tap whose own step comes from elsewhere: a field gets focus, a toggle reports its change. */
function tapIsNoise(control: Element): boolean {
  if (control instanceof HTMLSelectElement || isTextField(control)) return true;
  if (control instanceof HTMLInputElement && TOGGLES.has(control.type)) return true;
  if (control instanceof HTMLLabelElement) {
    const field = control.control;
    return field instanceof HTMLInputElement && TOGGLES.has(field.type);
  }
  return false;
}

/**
 * Records what the user did as steps: taps on controls, the value a field was left with, toggles,
 * choices and Enter. Only trusted events count, so app code and remote control never pass for the
 * user. A masked field yields its step without its value.
 */
export function watchSteps(
  push: (step: RecordedStep) => void,
  options: StepWatchOptions,
): () => void {
  const describe = (element: Element) =>
    describeTarget(element, { maskTextSelector: options.maskTextSelector });
  const ignored = (element: Element) =>
    Boolean(options.ignoreSelector && element.closest(options.ignoreSelector));
  const isMasked = (field: Field) =>
    options.maskAllInputs ||
    (field instanceof HTMLInputElement && field.type === "password") ||
    Boolean(options.maskTextSelector && field.closest(options.maskTextSelector));
  const trusted = options.trusted ?? ((event: Event) => event.isTrusted);
  /** The last value a field was reported with, so Enter and the change after it are one step. */
  const reported = new WeakMap<Element, string>();

  function safely<E extends Event>(handler: (event: E) => void) {
    return (event: E) => {
      if (!trusted(event)) return;
      try {
        handler(event);
      } catch {
        return;
      }
    };
  }

  function reportValue(field: Field): void {
    if (ignored(field)) return;
    if (field instanceof HTMLInputElement && TOGGLES.has(field.type)) {
      push({ kind: "step", action: "check", target: describe(field), checked: field.checked });
      return;
    }
    const value = field.value;
    if (reported.get(field) === value) return;
    reported.set(field, value);
    const masked = isMasked(field);
    push({
      kind: "step",
      action: field instanceof HTMLSelectElement ? "select" : "type",
      target: describe(field),
      value: masked ? null : value,
      ...(masked ? { masked: true } : {}),
    });
  }

  const onClick = safely((event: MouseEvent) => {
    const origin = event.target;
    if (!(origin instanceof Element)) return;
    const control = origin.closest(CONTROL) ?? origin;
    if (ignored(control) || tapIsNoise(control)) return;
    const box = control.getBoundingClientRect();
    push({
      kind: "step",
      action: "tap",
      target: describe(control),
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
      offsetX: Math.max(0, Math.round(event.clientX - box.left)),
      offsetY: Math.max(0, Math.round(event.clientY - box.top)),
    });
  });

  const onChange = safely((event: Event) => {
    if (isField(event.target)) reportValue(event.target);
  });

  const onKey = safely((event: KeyboardEvent) => {
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
    const field = event.target;
    if (ignored(field) || !isTextField(field)) return;
    reportValue(field);
    push({ kind: "step", action: "key", target: describe(field), key: "Enter" });
  });

  const listen = { capture: true, passive: true } as const;
  document.addEventListener("click", onClick, listen);
  document.addEventListener("change", onChange, listen);
  document.addEventListener("keydown", onKey, listen);
  return () => {
    document.removeEventListener("click", onClick, listen);
    document.removeEventListener("change", onChange, listen);
    document.removeEventListener("keydown", onKey, listen);
  };
}
