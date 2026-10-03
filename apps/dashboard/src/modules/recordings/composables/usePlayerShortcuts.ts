import { useEventListener } from "@vueuse/core";

export interface PlayerShortcuts {
  toggle: () => void;
  seekBy: (ms: number) => void;
  issue: (direction: 1 | -1) => void;
  view: (view: "screen" | "data" | "both") => void;
  follow: () => void;
}

/** The player's keys, ignored while the user is typing or driving another control. */
export function usePlayerShortcuts(actions: PlayerShortcuts): void {
  useEventListener(window, "keydown", (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable], [role=slider], [role=menu]")) {
      return;
    }
    const step = event.shiftKey ? 30_000 : 5000;
    const handlers: Record<string, () => void> = {
      Space: actions.toggle,
      ArrowLeft: () => actions.seekBy(-step),
      ArrowRight: () => actions.seekBy(step),
      KeyN: () => actions.issue(1),
      KeyP: () => actions.issue(-1),
      KeyS: () => actions.view("screen"),
      KeyD: () => actions.view("data"),
      KeyB: () => actions.view("both"),
      KeyF: actions.follow,
    };
    const handler = handlers[event.code];
    if (!handler) return;
    event.preventDefault();
    handler();
  });
}
