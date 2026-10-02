import type { ActivityCategory } from "../types";

/** Every category the server classifies update events into. */
export const ACTIVITY_CATEGORIES: readonly ActivityCategory[] = [
  "check",
  "downloading",
  "delivered",
  "failed",
  "cancelled",
  "lifecycle",
  "other",
];

const CATEGORIES = new Set<ActivityCategory>(ACTIVITY_CATEGORIES);

/** A category from the wire; anything a newer server invents reads as `other`. */
export function toCategory(value: unknown): ActivityCategory {
  return typeof value === "string" && CATEGORIES.has(value as ActivityCategory)
    ? (value as ActivityCategory)
    : "other";
}
