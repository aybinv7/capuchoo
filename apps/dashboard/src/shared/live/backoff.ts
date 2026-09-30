/** Exponential reconnect delay with full jitter, capped: 1s, 2s, 4s ... 30s. */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
  return Math.round(ceiling / 2 + (random() * ceiling) / 2);
}
