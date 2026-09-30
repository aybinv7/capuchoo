import { inject, provide, shallowRef, type InjectionKey, type ShallowRef } from "vue";
import type { Artefact } from "@/shared/types/release";

export const ARTEFACT_MIME = "application/x-capuchoo-artefact";

export interface CanvasDrag {
  /** The artefact being dragged. `dragover` cannot read the payload, so the canvas keeps it here. */
  artefact: ShallowRef<Artefact | null>;
  /** Channel the drag started from, so dropping back on it is not offered. */
  sourceChannelId: ShallowRef<string | null>;
  start(event: DragEvent, artefact: Artefact, sourceChannelId?: string | null): void;
  end(): void;
}

const KEY: InjectionKey<CanvasDrag> = Symbol("canvas-drag");

/** Owns the drag state for one canvas and hands it to every node below it. */
export function provideCanvasDrag(): CanvasDrag {
  const artefact = shallowRef<Artefact | null>(null);
  const sourceChannelId = shallowRef<string | null>(null);
  const drag: CanvasDrag = {
    artefact,
    sourceChannelId,
    start(event, value, source = null) {
      artefact.value = value;
      sourceChannelId.value = source;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData(ARTEFACT_MIME, value.id);
        event.dataTransfer.setData("text/plain", value.version_name);
      }
    },
    end() {
      artefact.value = null;
      sourceChannelId.value = null;
    },
  };
  provide(KEY, drag);
  return drag;
}

export function useCanvasDrag(): CanvasDrag {
  const drag = inject(KEY);
  if (!drag) throw new Error("useCanvasDrag() needs provideCanvasDrag() in an ancestor");
  return drag;
}
