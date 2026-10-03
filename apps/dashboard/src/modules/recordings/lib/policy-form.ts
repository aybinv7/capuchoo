import type { RecordingPolicy, RecordingPolicyPatch } from "@capuchoo/core";

const NESTED = ["tracks", "network", "database", "buffer"] as const;
type Nested = (typeof NESTED)[number];

/** A field of the policy: a top-level key, or `group.key` inside one of the four groups. */
export type PolicyPath = string;

function split(path: PolicyPath): [string, string | null] {
  const [head, tail] = path.split(".");
  return [head!, tail ?? null];
}

export function readPath(source: object, path: PolicyPath): unknown {
  const [head, tail] = split(path);
  const value = (source as Record<string, unknown>)[head];
  if (tail === null) return value;
  return value && typeof value === "object" ? (value as Record<string, unknown>)[tail] : undefined;
}

export function hasPath(patch: RecordingPolicyPatch, path: PolicyPath): boolean {
  return readPath(patch, path) !== undefined;
}

export function writePatch(
  patch: RecordingPolicyPatch,
  path: PolicyPath,
  value: unknown,
): RecordingPolicyPatch {
  const [head, tail] = split(path);
  if (tail === null) return { ...patch, [head]: value };
  const group = (patch as Record<string, Record<string, unknown> | undefined>)[head] ?? {};
  return { ...patch, [head]: { ...group, [tail]: value } };
}

export function clearPatch(patch: RecordingPolicyPatch, path: PolicyPath): RecordingPolicyPatch {
  const [head, tail] = split(path);
  const next = { ...patch } as Record<string, unknown>;
  if (tail === null) {
    delete next[head];
    return next as RecordingPolicyPatch;
  }
  const group = { ...(next[head] as Record<string, unknown> | undefined) };
  delete group[tail];
  if (Object.keys(group).length === 0) delete next[head];
  else next[head] = group;
  return next as RecordingPolicyPatch;
}

/** The policy a scope starts from, with `patch` laid over it. */
export function mergePolicy(base: RecordingPolicy, patch: RecordingPolicyPatch): RecordingPolicy {
  const merged = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    merged[key] = NESTED.includes(key as Nested)
      ? { ...(base[key as Nested] as object), ...(value as object) }
      : value;
  }
  return merged as unknown as RecordingPolicy;
}

export function samePatch(a: RecordingPolicyPatch, b: RecordingPolicyPatch): boolean {
  const canonical = (patch: RecordingPolicyPatch) =>
    JSON.stringify(patch, (_key, value: unknown) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([x], [y]) => x.localeCompare(y)))
        : value,
    );
  return canonical(a) === canonical(b);
}
