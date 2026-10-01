const START_TAB = "view-apps";

const activeTab = ref(START_TAB);

export function markTabShown(tabId: string): void {
  if (tabId) activeTab.value = tabId;
}

export const activeTabId = readonly(activeTab);
