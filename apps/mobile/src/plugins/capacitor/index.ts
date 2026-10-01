import type Framework7 from "framework7";
import { useAndroidBackButton } from "./useAndroidBackButton";
import { useKeyboard } from "./useKeyboard";
import { useStatusBar } from "./useStatusBar";

/**
 * Native wiring that needs the Framework7 instance, so it runs once the shell exists rather than at
 * module load. Every handler no-ops off-device, which is what keeps `vp dev` in a browser working.
 */
export async function initCapacitor(f7: Framework7): Promise<void> {
  await useAndroidBackButton(f7);
  useKeyboard(f7);
  await useStatusBar();
}
