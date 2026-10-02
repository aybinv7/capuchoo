import { nextTick, reactive } from "vue";
import { toast } from "vue-sonner";
import type { RunPreset } from "../lib/run-form";

export interface RunPipelineDialogState {
  open: boolean;
  /** True once loaded, so the dialog and its queries load only when first wanted. */
  mounted: boolean;
  preset: RunPreset;
}

export type RunPipelineDialogController = ReturnType<typeof useRunPipelineDialog>;

let loading: Promise<unknown> | null = null;

/** The dialog's chunk, fetched once and shared by every page that offers a run. */
export function loadRunPipelineDialog() {
  loading ??= import("../components/RunPipelineDialog.vue").catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading as Promise<typeof import("../components/RunPipelineDialog.vue")>;
}

/**
 * Whether the run dialog is open and what it was opened with. One page renders one dialog. The
 * first open mounts it closed and opens it a tick later: mounted already open, it would see focus
 * still on the trigger outside it and dismiss itself.
 */
export function useRunPipelineDialog() {
  const state = reactive<RunPipelineDialogState>({ open: false, mounted: false, preset: {} });

  return {
    state,
    show(preset: RunPreset = {}) {
      state.preset = { ...preset };
      if (state.mounted) {
        state.open = true;
        return;
      }
      loadRunPipelineDialog().then(
        async () => {
          state.mounted = true;
          await nextTick();
          state.open = true;
        },
        () =>
          toast.error("The run dialog could not load", {
            description: "Reload the page and try again.",
          }),
      );
    },
    setOpen(value: boolean) {
      state.open = value;
    },
  };
}
