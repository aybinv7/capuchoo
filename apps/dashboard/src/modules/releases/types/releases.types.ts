import type { Environment } from "@capuchoo/core";

export interface ReleasePatch {
  required?: boolean;
  release_notes?: string | null;
}

export interface ReleaseFilters {
  search: string;
  flavour: Environment | "all";
  platform: "all" | "android" | "ios" | "web";
}
