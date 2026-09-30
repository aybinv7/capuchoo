import { Copy, LogOut, Monitor, Moon, PanelLeft, Sun } from "@lucide/vue";
import { useClipboard, useColorMode } from "@vueuse/core";
import { computed } from "vue";
import { toast } from "vue-sonner";
import { useSidebar } from "@/components/ui/sidebar";
import { useCurrentApp } from "../../composables/useCurrentApp";
import { useSignOut } from "../../composables/useSignOut";
import type { SearchItem } from "../types";

/** Commands that act in place instead of opening a page. */
export function useActionItems() {
  const { store: mode } = useColorMode({ storageKey: "capuchoo.theme" });
  const { toggleSidebar } = useSidebar();
  const { copy, isSupported } = useClipboard({ legacy: true });
  const { app } = useCurrentApp();
  const signOut = useSignOut();

  return computed<SearchItem[]>(() => {
    const items: SearchItem[] = [
      {
        id: "action:theme-light",
        scope: "actions",
        label: "Light theme",
        keywords: ["appearance", "mode"],
        icon: Sun,
        run: () => {
          mode.value = "light";
        },
      },
      {
        id: "action:theme-dark",
        scope: "actions",
        label: "Dark theme",
        keywords: ["appearance", "mode", "night"],
        icon: Moon,
        run: () => {
          mode.value = "dark";
        },
      },
      {
        id: "action:theme-system",
        scope: "actions",
        label: "System theme",
        keywords: ["appearance", "mode", "auto"],
        icon: Monitor,
        run: () => {
          mode.value = "auto";
        },
      },
      {
        id: "action:sidebar",
        scope: "actions",
        label: "Toggle sidebar",
        keywords: ["collapse", "expand", "navigation"],
        icon: PanelLeft,
        shortcut: "Ctrl B",
        run: toggleSidebar,
      },
    ];
    const current = app.value;
    if (current && isSupported.value)
      items.push({
        id: "action:copy-app-id",
        scope: "actions",
        label: "Copy bundle identifier",
        hint: current.app_id,
        keywords: ["app id", "package", "clipboard"],
        icon: Copy,
        run: async () => {
          await copy(current.app_id);
          toast.success("Copied", { description: current.app_id });
        },
      });
    items.push({
      id: "action:sign-out",
      scope: "actions",
      label: "Sign out",
      keywords: ["logout", "log out", "exit"],
      icon: LogOut,
      run: () => signOut.mutate(),
    });
    return items;
  });
}
