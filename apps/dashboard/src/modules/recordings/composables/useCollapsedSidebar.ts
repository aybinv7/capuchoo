import { onBeforeUnmount, onMounted } from "vue";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * Folds the app's sidebar to its icon rail while the page is open and unfolds it on leaving, when it
 * was the page that folded it. A replay needs the width more than the navigation does.
 */
export function useCollapsedSidebar(): void {
  const sidebar = useSidebar();
  let folded = false;

  onMounted(() => {
    if (sidebar.isMobile.value || !sidebar.open.value) return;
    folded = true;
    sidebar.setOpen(false);
  });

  onBeforeUnmount(() => {
    if (folded && !sidebar.open.value) sidebar.setOpen(true);
  });
}
