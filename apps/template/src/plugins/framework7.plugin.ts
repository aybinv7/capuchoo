import routes from "@/router";
import { Capacitor } from "@capacitor/core";
import type { Framework7Parameters } from "framework7/types";

export const framework7 = (): Framework7Parameters => {
  // Read initial values from localStorage to avoid Pinia dependency at boot
  const initialDarkMode = localStorage.getItem("dark-mode") === "dark";
  const initialTheme = localStorage.getItem("f7-theme") || "auto";

  // Apply dark mode class immediately to avoid flash
  if (initialDarkMode && typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
  }

  return {
    name: "Capucho",

    // Framework7 uses 'ios', 'md', or 'aurora'. 'auto' detects platform.
    theme: (initialTheme as any) || "auto",
    darkMode: initialDarkMode,

    routes: routes,

    touch: {
      tapHold: true,
      tapHoldDelay: 500,
      tapHoldPreventClicks: true,
    },

    input: {
      scrollIntoViewOnFocus: true,
    },

    statusbar: {
      enabled: Capacitor.isNativePlatform(),
    },

    view: {
      animate: true,
    },

    colors: {
      primary: "#c96442",
    },

    panel: {
      swipe: true,
    },
  };
};
