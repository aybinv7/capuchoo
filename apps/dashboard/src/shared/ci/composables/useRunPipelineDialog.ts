import { reactive } from "vue";
import type { RunPreset } from "../lib/run-form";

export interface RunPipelineDialogState {
  open: boolean;
  /** True once opened, so the dialog and its queries load only when first wanted. */
  mounted: boolean;
  preset: RunPreset;
}

export type RunPipelineDialogController = ReturnType<typeof useRunPipelineDialog>;

/** Whether the run dialog is open and what it was opened with. One page renders one dialog. */
export function useRunPipelineDialog() {
  const state = reactive<RunPipelineDialogState>({ open: false, mounted: false, preset: {} });

  return {
    state,
    show(preset: RunPreset = {}) {
      state.preset = { ...preset };
      state.mounted = true;
      state.open = true;
    },
    setOpen(value: boolean) {
      state.open = value;
    },
  };
}
