import { computed, ref, toValue, type MaybeRefOrGetter } from "vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { previewPointer } from "@/shared/delivery/lib/eligibility";
import { artefactLabel } from "@/shared/lib/format";
import type { Channel } from "@/shared/types/release";
import { useCanvasContext } from "./useCanvasContext";
import { useCanvasDrag } from "./useCanvasDrag";

export type DropState =
  | { kind: "idle" }
  | { kind: "accept"; message: string }
  | { kind: "refuse"; message: string };

/**
 * Makes a channel node a drop target for a dragged artefact. While a drag is in progress the node
 * shows what the server would say: `canPoint` for the pointer and the role for the environment.
 * Only an accepted drop opens the Deliver confirmation; nothing moves without it.
 */
export function useDropTarget(channel: MaybeRefOrGetter<Channel>) {
  const drag = useCanvasDrag();
  const context = useCanvasContext();
  const permissions = useAppPermissions();
  const hovering = ref(false);

  const state = computed<DropState>(() => {
    const artefact = drag.artefact.value;
    const target = toValue(channel);
    if (!artefact) return { kind: "idle" };
    if (drag.sourceChannelId.value === target.id) return { kind: "idle" };
    const gate = permissions.deliver(target.environment);
    if (!gate.ok) return { kind: "refuse", message: gate.reason };
    const { verdict } = previewPointer({
      channel: target,
      artefact,
      catalog: context.catalog.value,
      servedByBase: target.base_channel_id
        ? context.servedByBase.value.get(target.base_channel_id)
        : undefined,
    });
    if (!verdict.ok) return { kind: "refuse", message: verdict.message };
    if (verdict.direction === "same")
      return { kind: "refuse", message: `Already serving ${artefactLabel(artefact)}.` };
    return { kind: "accept", message: `Drop to deliver ${artefactLabel(artefact)}` };
  });

  function onDragOver(event: DragEvent) {
    if (state.value.kind !== "accept") return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  }

  function onDrop(event: DragEvent) {
    hovering.value = false;
    const artefact = drag.artefact.value;
    if (state.value.kind !== "accept" || !artefact) return;
    event.preventDefault();
    context.dialogs.deliver(toValue(channel), artefact.id);
    drag.end();
  }

  return {
    state,
    hovering,
    handlers: {
      dragenter: () => (hovering.value = true),
      dragleave: (event: DragEvent) => {
        const next = event.relatedTarget as Node | null;
        if (!next || !(event.currentTarget as HTMLElement).contains(next)) hovering.value = false;
      },
      dragover: onDragOver,
      drop: onDrop,
    },
  };
}
