import type { RecordedStep, StepTarget } from "@capuchoo/core";

/** What a person would call the element: its name, its text, its test id, or its tag. */
export function targetName(target: StepTarget): string {
  return (
    target.name ??
    target.text ??
    target.testId?.value ??
    target.id ??
    (target.inputType ? `${target.inputType} field` : target.tag)
  );
}

const quoted = (value: string) => `"${value.length > 40 ? `${value.slice(0, 39)}…` : value}"`;

/** One line for Activity: what the user did, in their words. */
export function stepLabel(step: RecordedStep): string {
  const name = targetName(step.target);
  switch (step.action) {
    case "tap":
      return `Tapped ${quoted(name)}`;
    case "type":
      if (step.masked) return `Typed in ${name} (masked)`;
      return step.value ? `Typed ${quoted(step.value)} in ${name}` : `Cleared ${name}`;
    case "check":
      return `${step.checked ? "Checked" : "Unchecked"} ${name}`;
    case "select":
      return step.masked
        ? `Chose in ${name} (masked)`
        : `Chose ${quoted(step.value ?? "")} in ${name}`;
    case "key":
      return `Pressed ${step.key ?? "a key"} in ${name}`;
  }
}
