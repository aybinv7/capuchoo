import type { Column, Row } from "@tanstack/vue-table";
import type { ExportCell, ExportFormat } from "../types";

const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** Spreadsheets execute cells starting with a formula character; a leading quote neutralises it. */
export function neutraliseFormula(value: string): string {
  return FORMULA_LEAD.test(value) ? `'${value}` : value;
}

export function csvCell(value: ExportCell): string {
  if (value === null || value === undefined) return "";
  const text = neutraliseFormula(String(value));
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface ExportColumn<T> {
  id: string;
  title: string;
  value: (row: T) => ExportCell;
}

export function toCsv<T>(rows: readonly T[], columns: readonly ExportColumn<T>[]): string {
  const header = columns.map((column) => csvCell(column.title)).join(",");
  const body = rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(","));
  return [header, ...body].join("\r\n");
}

export function toJson<T>(rows: readonly T[], columns: readonly ExportColumn<T>[]): string {
  return JSON.stringify(
    rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column.id, column.value(row) ?? null])),
    ),
    null,
    2,
  );
}

function plainValue(value: unknown): ExportCell {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
}

/** The visible, exportable columns of a table, in display order. */
export function exportColumns<T>(columns: readonly Column<T, unknown>[]): ExportColumn<T>[] {
  return columns
    .filter(
      (column) =>
        column.getIsVisible() &&
        !column.columnDef.meta?.fixed &&
        (column.accessorFn || column.columnDef.meta?.exportValue),
    )
    .map((column) => {
      const meta = column.columnDef.meta;
      return {
        id: column.id,
        title: meta?.title ?? column.id,
        value: (row: T) =>
          meta?.exportValue ? meta.exportValue(row) : plainValue(column.accessorFn?.(row, 0)),
      };
    });
}

export function exportRows<T>(rows: readonly Row<T>[]): T[] {
  return rows.map((row) => row.original);
}

const MIME: Record<ExportFormat, string> = {
  csv: "text/csv;charset=utf-8",
  json: "application/json;charset=utf-8",
};

/** Saves the export through an object URL, released once the click has been dispatched. */
export function download(content: string, filename: string, format: ExportFormat): void {
  const blob = new Blob([format === "csv" ? `﻿${content}` : content], { type: MIME[format] });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.${format}`;
  link.rel = "noopener";
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function exportFilename(base: string, now = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${base.replace(/[^\w.-]+/g, "-")}-${stamp}`;
}
