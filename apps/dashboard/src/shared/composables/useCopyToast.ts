import { useClipboard } from "@vueuse/core";
import { toast } from "vue-sonner";

/** Copies text on demand and says so in a toast; a refused clipboard is reported, not swallowed. */
export function useCopyToast() {
  const { copy, isSupported } = useClipboard({ legacy: true });

  async function copyText(value: string, label: string): Promise<void> {
    try {
      await copy(value);
      toast.success(`Copied ${label}`);
    } catch {
      toast.error(`Could not copy ${label}`, {
        description: "The browser refused access to the clipboard.",
      });
    }
  }

  return { copyText, isSupported };
}
