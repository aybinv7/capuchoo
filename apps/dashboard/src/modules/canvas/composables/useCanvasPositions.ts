import { useStorage } from "@vueuse/core";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import type { NodePosition } from "../lib/layout";

const PREFIX = "capuchoo.canvas.positions.";
/** Enough for every card an app can show; anything beyond is a corrupted entry, not a layout. */
const MAX_ENTRIES = 200;

type Stored = Record<string, NodePosition>;

function sanitize(value: unknown): Stored {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const clean: Stored = {};
  for (const [id, position] of Object.entries(value).slice(0, MAX_ENTRIES)) {
    const { x, y } = (position ?? {}) as Partial<NodePosition>;
    if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y))
      clean[id] = { x: Math.round(x), y: Math.round(y) };
  }
  return clean;
}

/**
 * Where the user moved cards on one app's canvas, per browser. A card that was never moved keeps
 * following the automatic layout; unreadable storage falls back to it entirely.
 */
export function useCanvasPositions(appId: MaybeRefOrGetter<string>) {
  const stored = useStorage<Stored>(() => `${PREFIX}${toValue(appId)}`, {}, undefined, {
    serializer: {
      read: (raw) => {
        try {
          return sanitize(JSON.parse(raw));
        } catch {
          return {};
        }
      },
      write: (value) => JSON.stringify(value),
    },
    onError: () => undefined,
  });

  const positions = computed<ReadonlyMap<string, NodePosition>>(
    () => new Map(Object.entries(stored.value)),
  );

  return {
    positions,
    moved: computed(() => positions.value.size > 0),
    move(id: string, position: NodePosition) {
      if (id.startsWith("lane:")) return;
      stored.value = {
        ...stored.value,
        [id]: { x: Math.round(position.x), y: Math.round(position.y) },
      };
    },
    reset() {
      stored.value = {};
    },
  };
}
