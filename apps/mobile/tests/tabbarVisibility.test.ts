import { expect, test } from "vite-plus/test";
import { markTabShown } from "../src/shared/composables/useActiveTab.js";
import { useTabbarVisibility } from "../src/shared/composables/useTabbarVisibility.js";

test("a page pushed in one tab hides the bar in that tab only", () => {
  const { isVisible, hideTabbar } = useTabbarVisibility();
  markTabShown("view-apps");
  expect(isVisible.value).toBe(true);

  const releaseActivity = hideTabbar("view-activity");
  expect(isVisible.value, "Apps is a tab root; Activity's pushed page is not on screen").toBe(true);

  markTabShown("view-activity");
  expect(isVisible.value).toBe(false);

  const releaseSecond = hideTabbar("view-activity");
  releaseActivity();
  expect(isVisible.value, "still one page pushed in Activity").toBe(false);
  releaseSecond();
  releaseSecond();
  expect(isVisible.value).toBe(true);

  const releaseAnywhere = hideTabbar(null);
  markTabShown("view-apps");
  expect(isVisible.value, "a request from outside any view hides it everywhere").toBe(false);
  releaseAnywhere();
  expect(isVisible.value).toBe(true);
});

test("the keyboard hides the bar on a tab root too", () => {
  const { isVisible, setKeyboardOpen } = useTabbarVisibility();
  markTabShown("view-apps");
  setKeyboardOpen(true);
  expect(isVisible.value).toBe(false);
  setKeyboardOpen(false);
  expect(isVisible.value).toBe(true);
});
