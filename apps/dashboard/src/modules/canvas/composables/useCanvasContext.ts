import { inject, provide, type ComputedRef, type InjectionKey } from "vue";
import type { RunPreset } from "@/shared/ci/lib/run-form";
import type { DeliveryDialogController } from "@/shared/delivery/composables/useDeliveryDialogs";
import type { ReleaseCatalog } from "@/shared/types/release";

export interface CanvasContext {
  catalog: ComputedRef<ReleaseCatalog>;
  /** Base channel id to the artefact ids it has served. */
  servedByBase: ComputedRef<Map<string, Set<string>>>;
  dialogs: DeliveryDialogController;
  /** Starting a pipeline from the canvas; `reason` says why it is unavailable, else null. */
  pipeline: {
    reason: ComputedRef<string | null>;
    run: (preset?: RunPreset) => void;
  };
}

const KEY: InjectionKey<CanvasContext> = Symbol("canvas-context");

export function provideCanvasContext(context: CanvasContext): CanvasContext {
  provide(KEY, context);
  return context;
}

export function useCanvasContext(): CanvasContext {
  const context = inject(KEY);
  if (!context) throw new Error("useCanvasContext() needs provideCanvasContext() in an ancestor");
  return context;
}
