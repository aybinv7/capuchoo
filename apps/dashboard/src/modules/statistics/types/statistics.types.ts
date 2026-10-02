export const STAT_WINDOWS = [7, 30, 90] as const;
export type StatWindow = (typeof STAT_WINDOWS)[number];
