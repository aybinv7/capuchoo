import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

/** Android's share sheet on a device; the clipboard in a browser, which has no sheet to offer. */
export async function shareLink(input: {
  title: string;
  text: string;
  url: string;
}): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Share.share({ ...input, dialogTitle: input.title });
    return;
  }
  await navigator.clipboard.writeText(input.url);
}

export async function copyLink(url: string): Promise<void> {
  await navigator.clipboard.writeText(url);
}
