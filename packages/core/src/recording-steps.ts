/**
 * What the user did, step by step, as the recorder saw it: the action and every way a test could
 * find its element again. A step travels as a `marker` line with `kind: "step"`, so older servers
 * and dashboards store and ignore it.
 */

export const STEP_ACTIONS = ["tap", "type", "check", "select", "key"] as const;
export type StepAction = (typeof STEP_ACTIONS)[number];

export interface StepTarget {
  tag: string;
  /** Explicit or implied ARIA role. */
  role: string | null;
  /** Accessible name: aria-label, label, placeholder, alt, or short text. Null when masked. */
  name: string | null;
  /** The element's own short text. Null when masked or too long to name it. */
  text: string | null;
  testId: { attribute: string; value: string } | null;
  /** An id that looks hand-written, not generated. */
  id: string | null;
  /** A CSS path that found exactly this element when the step happened. */
  css: string;
  /** Whether each locator alone found exactly this element at the time. */
  unique: { testId: boolean; id: boolean; text: boolean };
  inputType: string | null;
}

export interface RecordedStep {
  kind: "step";
  action: StepAction;
  target: StepTarget;
  /** What was typed or chosen; null when the field is masked. */
  value?: string | null;
  masked?: boolean;
  checked?: boolean;
  key?: string;
  /** Where the tap landed, in CSS pixels of the viewport. */
  x?: number;
  y?: number;
  /** Where the tap landed inside the element, in CSS pixels from its top-left corner. */
  offsetX?: number;
  offsetY?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === "string" ? value : null);
const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

function parseTarget(raw: unknown): StepTarget | null {
  if (!isRecord(raw) || typeof raw.tag !== "string" || typeof raw.css !== "string") return null;
  const test = isRecord(raw.testId) ? raw.testId : null;
  const unique = isRecord(raw.unique) ? raw.unique : {};
  return {
    tag: raw.tag,
    role: str(raw.role),
    name: str(raw.name),
    text: str(raw.text),
    testId:
      test && typeof test.attribute === "string" && typeof test.value === "string"
        ? { attribute: test.attribute, value: test.value }
        : null,
    id: str(raw.id),
    css: raw.css,
    unique: {
      testId: unique.testId === true,
      id: unique.id === true,
      text: unique.text === true,
    },
    inputType: str(raw.inputType),
  };
}

/** A step from a marker's data, or null when the data is not one. */
export function parseRecordedStep(raw: unknown): RecordedStep | null {
  if (!isRecord(raw) || raw.kind !== "step") return null;
  const action = raw.action;
  if (typeof action !== "string" || !(STEP_ACTIONS as readonly string[]).includes(action)) {
    return null;
  }
  const target = parseTarget(raw.target);
  if (!target) return null;
  const step: RecordedStep = { kind: "step", action: action as StepAction, target };
  if ("value" in raw) step.value = str(raw.value);
  if (raw.masked === true) step.masked = true;
  if (typeof raw.checked === "boolean") step.checked = raw.checked;
  if (typeof raw.key === "string") step.key = raw.key;
  const x = num(raw.x);
  const y = num(raw.y);
  if (x !== undefined && y !== undefined) {
    step.x = x;
    step.y = y;
  }
  const offsetX = num(raw.offsetX);
  const offsetY = num(raw.offsetY);
  if (offsetX !== undefined && offsetY !== undefined) {
    step.offsetX = offsetX;
    step.offsetY = offsetY;
  }
  return step;
}
