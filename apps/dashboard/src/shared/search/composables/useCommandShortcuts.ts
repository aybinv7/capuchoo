import { useEventListener } from "@vueuse/core";
import { useCommandStore } from "../../stores/command.store";

function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/** Ctrl/⌘+K toggles the palette anywhere; `/` opens it when the focus is not in a field. */
export function useCommandShortcuts() {
  const store = useCommandStore();
  useEventListener(window, "keydown", (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      store.toggle();
      return;
    }
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !typing(event.target)) {
      event.preventDefault();
      store.show();
    }
  });
}
