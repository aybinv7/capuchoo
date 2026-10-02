const PLATFORMS: Record<string, string> = { android: "Android", ios: "iOS", web: "Web" };

/** `Android`, `iOS`, `Web`; null for a platform the dashboard does not know. */
export const platformLabel = (platform: string | null | undefined): string | null =>
  PLATFORMS[platform ?? ""] ?? null;

const TILES: Record<string, string> = {
  android: "bg-success-soft text-success ring-success/20",
  ios: "bg-muted text-foreground ring-border",
  web: "bg-info-soft text-info ring-info/20",
};

/** The tinted square behind a platform glyph. */
export const platformTile = (platform: string | null | undefined): string =>
  TILES[platform ?? ""] ?? "bg-muted text-muted-foreground ring-border";
