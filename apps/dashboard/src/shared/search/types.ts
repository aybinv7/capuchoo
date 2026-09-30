import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";

export type SearchScope =
  | "all"
  | "pages"
  | "apps"
  | "channels"
  | "releases"
  | "builds"
  | "devices"
  | "actions";

export interface SearchItem {
  id: string;
  scope: Exclude<SearchScope, "all">;
  label: string;
  /** Secondary line: where it lives, its version, its state. */
  hint?: string;
  /** Extra text matched by the query but not shown. */
  keywords?: readonly string[];
  icon?: Component;
  shortcut?: string;
  to?: RouteLocationRaw;
  run?: () => void | Promise<void>;
}

export interface RankedItem {
  item: SearchItem;
  score: number;
}
