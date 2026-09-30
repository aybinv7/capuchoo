import type { ColumnDef, RowData } from "@tanstack/vue-table";
import type { Component } from "vue";

/**
 * A column of any value type. `ColumnDef<T, unknown>[]` would reject the typed columns a column
 * helper returns, because the value type sits in both input and output positions.
 */
export type AnyColumnDef<T> = ColumnDef<T, any>;

export type Density = "compact" | "normal" | "comfortable";

export const DENSITIES: readonly Density[] = ["compact", "normal", "comfortable"];

export type ExportFormat = "csv" | "json";

export type ExportCell = string | number | boolean | null | undefined;

export interface FacetOption {
  label: string;
  value: string;
  icon?: Component;
}

/**
 * A prefilter over one column. Without `options` the values are read from the loaded rows, with
 * their counts; server-filtered tables pass the options they accept.
 */
export interface DataTableFacet {
  columnId: string;
  title: string;
  options?: readonly FacetOption[];
  /** One value at a time, for filters the server takes as a single parameter. */
  single?: boolean;
}

export interface DataTableFeatures {
  search: boolean;
  density: boolean;
  viewOptions: boolean;
  export: boolean;
  selection: boolean;
  sorting: boolean;
  pinning: boolean;
  reorder: boolean;
  pagination: boolean;
}

export const DEFAULT_FEATURES: DataTableFeatures = {
  search: true,
  density: true,
  viewOptions: true,
  export: true,
  selection: false,
  sorting: true,
  pinning: true,
  reorder: true,
  pagination: true,
};

export const PAGE_SIZES: readonly number[] = [10, 20, 50, 100];

declare module "@tanstack/vue-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Header label, also used by the view menu, the column menu and exports. */
    title?: string;
    align?: "left" | "right" | "center";
    headerClass?: string;
    cellClass?: string;
    /** Value written to exports; defaults to the column's accessor value. */
    exportValue?: (row: TData) => ExportCell;
    /** Hidden until the viewer shows it; still searchable while hidden. */
    defaultHidden?: boolean;
    /** Selection and row-action columns: never hidden, moved, pinned or exported. */
    fixed?: boolean;
    /** Label of a facet value read from the rows. */
    facetLabel?: (value: TValue) => string;
  }
}
