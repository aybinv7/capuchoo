export const STAT_WINDOWS = [7, 30, 90] as const;
export type StatWindow = (typeof STAT_WINDOWS)[number];

/** Recordings are kept 14 days, so the sessions view never asks for more. */
export const SESSION_WINDOWS = [7, 14] as const;
export type SessionWindow = (typeof SESSION_WINDOWS)[number];
