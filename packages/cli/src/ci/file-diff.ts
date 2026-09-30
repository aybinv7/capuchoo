/**
 * A compact line diff for confirming a file replacement: lines only in `before` as `-`, lines only
 * in `after` as `+`, counted by occurrence so repeated lines are not hidden. At most `limit` lines.
 */
export function describeReplacement(
  file: string,
  before: string,
  after: string,
  limit = 60,
): string {
  const count = (lines: string[]) => {
    const counts = new Map<string, number>();
    for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1);
    return counts;
  };

  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const remaining = count(afterLines);
  const removed: string[] = [];
  for (const line of beforeLines) {
    const left = remaining.get(line) ?? 0;
    if (left > 0) remaining.set(line, left - 1);
    else if (line.trim()) removed.push(`  - ${line}`);
  }

  const kept = count(beforeLines);
  const added: string[] = [];
  for (const line of afterLines) {
    const left = kept.get(line) ?? 0;
    if (left > 0) kept.set(line, left - 1);
    else if (line.trim()) added.push(`  + ${line}`);
  }

  const lines = [...removed, ...added];
  const shown = lines.slice(0, limit);
  if (lines.length > limit) shown.push(`  ... ${lines.length - limit} more`);
  return [file, ...shown].join("\n");
}
