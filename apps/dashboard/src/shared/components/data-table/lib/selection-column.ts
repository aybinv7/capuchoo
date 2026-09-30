import { h } from "vue";
import { Checkbox } from "@/components/ui/checkbox";
import type { AnyColumnDef } from "../types";

/** The leading checkbox column; the header selects the current page. */
export function selectionColumn<T>(): AnyColumnDef<T> {
  return {
    id: "select",
    size: 40,
    enableSorting: false,
    enableHiding: false,
    enablePinning: false,
    enableGlobalFilter: false,
    meta: { fixed: true, headerClass: "w-10", cellClass: "w-10" },
    header: ({ table }) =>
      h(Checkbox, {
        modelValue: table.getIsAllPageRowsSelected()
          ? true
          : table.getIsSomePageRowsSelected()
            ? "indeterminate"
            : false,
        "onUpdate:modelValue": (value: boolean | "indeterminate") =>
          table.toggleAllPageRowsSelected(value === true),
        "aria-label": "Select this page",
      }),
    cell: ({ row }) =>
      h(Checkbox, {
        modelValue: row.getIsSelected(),
        disabled: !row.getCanSelect(),
        "onUpdate:modelValue": (value: boolean | "indeterminate") =>
          row.toggleSelected(value === true),
        onClick: (event: MouseEvent) => event.stopPropagation(),
        "aria-label": "Select row",
      }),
  };
}

/** The trailing row-actions column, rendered by the page through its `cell-actions` slot. */
export function actionsColumn<T>(size = 56): AnyColumnDef<T> {
  return {
    id: "actions",
    size,
    enableSorting: false,
    enableHiding: false,
    enablePinning: false,
    enableGlobalFilter: false,
    meta: { fixed: true, align: "right", cellClass: "w-0" },
    header: () => null,
  };
}
