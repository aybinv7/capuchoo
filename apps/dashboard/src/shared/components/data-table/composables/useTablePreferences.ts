import { useStorage, type RemovableRef } from "@vueuse/core";
import { ref, type Ref } from "vue";
import { defaultPreferences, sanitizePreferences, type TablePreferences } from "../lib/preferences";

const PREFIX = "capuchoo.table.";

/**
 * Density, page size, hidden, ordered and pinned columns of one table, per browser. Without a
 * `tableId` the choices last for the page only. Unreadable storage (private mode, quota, a value
 * from an older build) falls back to the defaults instead of failing the page.
 */
export function useTablePreferences(
  tableId: string | undefined,
  pageSize?: number,
): Ref<TablePreferences> | RemovableRef<TablePreferences> {
  const fallback = defaultPreferences(pageSize);
  if (!tableId) return ref(fallback);
  return useStorage<TablePreferences>(`${PREFIX}${tableId}`, fallback, undefined, {
    serializer: {
      read: (raw) => {
        try {
          return sanitizePreferences(JSON.parse(raw), fallback);
        } catch {
          return fallback;
        }
      },
      write: (value) => JSON.stringify(value),
    },
    onError: () => undefined,
  });
}
