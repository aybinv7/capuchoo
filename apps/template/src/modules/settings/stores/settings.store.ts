import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { f7 } from "framework7-vue";

export const useSettingsStore = defineStore(
  "settings",
  () => {
    const darkMode = ref(localStorage.getItem("dark-mode") === "dark");
    const theme = ref<string>(localStorage.getItem("app-theme") || "auto"); // 'ios', 'md', 'aurora', 'auto'

    // Framework7 platform theme - can be forced
    const f7Theme = ref<"ios" | "md" | "aurora" | "auto">(
      (localStorage.getItem("f7-theme") as any) || "auto",
    );

    const notificationsEnabled = ref(
      localStorage.getItem("notifications-enabled") !== "false",
    );

    function toggleDarkMode() {
      darkMode.value = !darkMode.value;
      applyTheme();
    }

    function toggleNotifications() {
      notificationsEnabled.value = !notificationsEnabled.value;
      localStorage.setItem(
        "notifications-enabled",
        String(notificationsEnabled.value),
      );
    }

    function setDarkMode(val: boolean) {
      darkMode.value = val;
      applyTheme();
    }

    function setF7Theme(val: "ios" | "md" | "aurora" | "auto") {
      f7Theme.value = val;
      localStorage.setItem("f7-theme", val);
      // Changing the theme usually requires a reload in F7 if changed dynamically on root
      window.location.reload();
    }

    function applyTheme() {
      const html = document.documentElement;
      if (darkMode.value) {
        html.classList.add("dark");
        localStorage.setItem("dark-mode", "dark");
        if (f7.initialized) f7.setDarkMode(true);
      } else {
        html.classList.remove("dark");
        localStorage.setItem("dark-mode", "light");
        if (f7.initialized) f7.setDarkMode(false);
      }
    }

    // Initial apply
    if (typeof document !== "undefined") {
      applyTheme();
    }

    return {
      darkMode,
      theme,
      f7Theme,
      toggleDarkMode,
      setDarkMode,
      setF7Theme,
      applyTheme,
      notificationsEnabled,
      toggleNotifications,
    };
  },
  {
    persist: true,
  },
);
