import { Capacitor } from "@capacitor/core";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";
import type Framework7 from "framework7";
import { useTabbarVisibility } from "@/shared/composables/useTabbarVisibility";

/**
 * Two problems the platform will not solve for you.
 *
 * The focused input scrolls out of view as the keyboard animates in, so it is scrolled back on
 * every phase of the transition rather than once: the layout is still settling when
 * `keyboardWillShow` fires, and only `keyboardDidShow` sees the final height.
 *
 * The tab bar sits above the keyboard and steals a row of screen from the field being typed into,
 * so it hides while the keyboard is open. That state is shared, not local, because the bar is
 * rendered by the shell and the input is somewhere deep in a page.
 */
export function useKeyboard(f7: Framework7): void {
  if (!Capacitor.isNativePlatform()) return;

  const $ = f7.$;
  const { setKeyboardOpen } = useTabbarVisibility();

  if (Capacitor.getPlatform() === "ios") {
    void Keyboard.setResizeMode({ mode: KeyboardResize.Native });
    void Keyboard.setScroll({ isDisabled: true });
  }

  const scrollFocusedIntoView = () => {
    if (document.activeElement) {
      f7.input.scrollIntoView(document.activeElement as HTMLElement, 0, true, true);
    }
  };

  void Keyboard.addListener("keyboardWillShow", () => {
    setKeyboardOpen(true);
    scrollFocusedIntoView();
  });

  void Keyboard.addListener("keyboardDidShow", scrollFocusedIntoView);
  void Keyboard.addListener("keyboardWillHide", scrollFocusedIntoView);

  void Keyboard.addListener("keyboardDidHide", () => {
    setKeyboardOpen(false);

    // A message bar keeps its accessory row; restoring it here would push the composer up.
    if (document.activeElement && $(document.activeElement).parents(".messagebar").length) return;

    if (Capacitor.getPlatform() === "ios") {
      void Keyboard.setAccessoryBarVisible({ isVisible: true });
    }
  });

  // Tapping outside an input should dismiss the keyboard. Without this it stays up until the field
  // is blurred by something else, covering half the screen.
  $(document).on("touchstart", (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if ($(target).closest("input, textarea, [contenteditable], .messagebar").length) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}
