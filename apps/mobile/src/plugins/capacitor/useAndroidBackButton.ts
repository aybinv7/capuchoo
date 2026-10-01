import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type Framework7 from "framework7";

/**
 * Android's back button must close whatever is on top before it navigates, and the order matters:
 * an actions sheet sitting over a popup has to close first, or back dismisses the popup underneath
 * and leaves the sheet orphaned.
 *
 * A popup that hosts its own view is a special case - back should walk that view's history first
 * and only close the popup once there is nothing left to go back to. Mark a popup
 * `custom-popup-close` when it owns its dismissal (an unsaved-changes prompt, say) and this leaves
 * it alone.
 */
export async function useAndroidBackButton(f7: Framework7): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const $ = f7.$;

  await App.addListener("backButton", () => {
    if ($(".actions-modal.modal-in").length) {
      f7.actions.close(".actions-modal.modal-in");
      return;
    }
    if ($(".dialog.modal-in").length) {
      f7.dialog.close(".dialog.modal-in");
      return;
    }
    if ($(".sheet-modal.modal-in").length) {
      f7.sheet.close(".sheet-modal.modal-in");
      return;
    }
    if ($(".popover.modal-in").length) {
      f7.popover.close(".popover.modal-in");
      return;
    }
    if ($(".popup.modal-in").length) {
      if ($(".popup.modal-in>.view").length) {
        const popupView = f7.views.get(".popup.modal-in>.view");
        if (popupView?.router && popupView.router.history.length > 1) {
          popupView.router.back();
          return;
        }
      }
      if ($(".popup.custom-popup-close").length) return;
      f7.popup.close(".popup.modal-in");
      return;
    }
    if ($(".login-screen.modal-in").length) {
      f7.loginScreen.close(".login-screen.modal-in");
      return;
    }
    if ($(".panel.panel-in").length) {
      f7.panel.close(".panel.panel-in");
      return;
    }

    const view = f7.views.current;
    if (view?.router && view.router.history.length > 1) {
      view.router.back();
      return;
    }

    // Nothing left to dismiss or unwind: let the app go to the background rather than exit, so
    // returning to it restores the same screen.
    void App.minimizeApp();
  });
}
