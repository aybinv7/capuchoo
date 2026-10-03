import { useElementSize, useMediaQuery } from "@vueuse/core";
import { computed, type CSSProperties, type Ref } from "vue";

/** Room around the device frame inside the stage. */
const STAGE_PADDING = 56;
const MIN_STAGE = 300;
/** The screen never takes more than this share of the width while the inspector is open. */
const MAX_SHARE = 0.62;
/** A modern phone, for the moments before the recording says what it was. */
const FALLBACK_ASPECT = 9 / 19.5;

/**
 * How wide the stage is: as wide as the recorded screen needs at the full height available, so a
 * portrait phone gets a tall narrow column and a landscape tablet a wide one, and every other pixel
 * goes to the inspector. Below `lg` the stage stacks above the inspector instead.
 */
export function useStageLayout(input: {
  workspace: Ref<HTMLElement | null>;
  viewport: Ref<{ width: number; height: number } | null>;
  fallback: Ref<{ width: number; height: number } | null>;
  panel: Ref<boolean>;
}) {
  const area = useElementSize(input.workspace);
  const wide = useMediaQuery("(min-width: 1024px)");

  const aspect = computed(() => {
    for (const size of [input.viewport.value, input.fallback.value]) {
      if (size && size.width > 0 && size.height > 0) return size.width / size.height;
    }
    return FALLBACK_ASPECT;
  });

  const stageStyle = computed<CSSProperties>(() => {
    if (!wide.value || !input.panel.value || area.width.value === 0) return {};
    const fit = area.height.value * aspect.value + STAGE_PADDING;
    const width = Math.min(Math.max(fit, MIN_STAGE), area.width.value * MAX_SHARE);
    return { width: `${Math.round(width)}px` };
  });

  return { wide, stageStyle };
}
