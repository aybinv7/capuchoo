const KEY = "capuchoo.onboarded";

/**
 * Whether this phone has been through the welcome. A per-device convenience, not data: losing it
 * shows the welcome once more, which costs one tap on Skip.
 */
const onboarded = useLocalStorage(KEY, false, { writeDefaults: false });

export const hasOnboarded = readonly(onboarded);

export function finishOnboarding(): void {
  onboarded.value = true;
}
