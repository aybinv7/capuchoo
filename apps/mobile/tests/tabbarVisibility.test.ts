import { expect, test } from "vite-plus/test";
import { markTabShown } from "../src/shared/composables/useActiveTab.js";
import { useTabbarVisibility } from "../src/shared/composables/useTabbarVisibility.js";

test("a page pushed in one tab hides the bar in that tab only", () => {
  const { isVisible, hideTabbar } = useTabbarVisibility();
  markTabShown("view-home");
  expect(isVisible.value).toBe(true);

  const releaseDevices = hideTabbar("view-devices");
  expect(isVisible.value, "Home is a tab root; Devices' pushed page is not on screen").toBe(true);

  markTabShown("view-devices");
  expect(isVisible.value).toBe(false);

  const releaseSecond = hideTabbar("view-devices");
  releaseDevices();
  expect(isVisible.value, "still one page pushed in Devices").toBe(false);
  releaseSecond();
  releaseSecond();
  expect(isVisible.value).toBe(true);

  const releaseAnywhere = hideTabbar(null);
  markTabShown("view-home");
  expect(isVisible.value, "a request from outside any view hides it everywhere").toBe(false);
  releaseAnywhere();
  expect(isVisible.value).toBe(true);
});

test("the keyboard hides the bar on a tab root too", () => {
  const { isVisible, setKeyboardOpen } = useTabbarVisibility();
  markTabShown("view-home");
  setKeyboardOpen(true);
  expect(isVisible.value).toBe(false);
  setKeyboardOpen(false);
  expect(isVisible.value).toBe(true);
});
