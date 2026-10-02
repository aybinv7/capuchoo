import { createHash } from "node:crypto";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Deterministic pseudo-random numbers (mulberry32), so every seed produces the same world. */
export class Dice {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  between(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)]!;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

export const checksumOf = (label: string): string =>
  createHash("sha256").update(label).digest("hex");
