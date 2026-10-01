import { Capacitor } from "@capacitor/core";
import type { Framework7Parameters } from "framework7/types";
import routes from "@/router";
import { BRAND_PRIMARY } from "@/shared/utils/theme/brand";

/** Android is the target, so the Material theme is pinned rather than offered as a setting. */
export function framework7Parameters(darkMode: boolean): Framework7Parameters {
  return {
    name: "Capuchoo",
    theme: "md",
    darkMode,
    routes,

    // Long-press is a real gesture on touch; without preventClicks it also fires a tap.
    touch: { tapHold: true, tapHoldDelay: 500, tapHoldPreventClicks: true },

    input: { scrollIntoViewOnFocus: true },

    // The bar is drawn by the OS and overlaid; see useStatusBar.
    statusbar: { enabled: Capacitor.isNativePlatform() },

    view: {
      animate: true,
      browserHistory: false,
      /** Pages come in from the end edge, with the page beneath drifting and dimming. */
      transition: "cap-end",
    },

    /** Framework7's own palette is overridden by materialScheme.ts; this keeps its derived tints close. */
    colors: { primary: BRAND_PRIMARY },
  };
}
