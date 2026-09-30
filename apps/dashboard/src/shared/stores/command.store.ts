import { useStorage } from "@vueuse/core";
import { defineStore } from "pinia";
import { ref } from "vue";

const RECENT_LIMIT = 6;

/** The command palette's visibility and the results the viewer picked most recently. */
export const useCommandStore = defineStore("command", () => {
  const open = ref(false);
  const recents = useStorage<string[]>("capuchoo.command.recents", [], undefined, {
    onError: () => undefined,
  });

  function show() {
    open.value = true;
  }

  function toggle() {
    open.value = !open.value;
  }

  function remember(id: string) {
    const list = Array.isArray(recents.value) ? recents.value : [];
    recents.value = [id, ...list.filter((entry) => entry !== id)].slice(0, RECENT_LIMIT);
  }

  return { open, recents, show, toggle, remember };
});
