/** Whether the UI should offer an action, and the sentence to show when it should not. */
export type Gate = { ok: true } | { ok: false; reason: string };

export const ALLOW: Gate = Object.freeze({ ok: true });

export function deny(reason: string): Gate {
  return { ok: false, reason };
}

/** The first refusal among several conditions, or allow. */
export function firstRefusal(...gates: Gate[]): Gate {
  return gates.find((gate) => !gate.ok) ?? ALLOW;
}
