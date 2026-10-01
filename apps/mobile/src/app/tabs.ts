export interface TabDefinition {
  /** Also the tab's DOM id (`view-<id>`) and the first segment of its route. */
  id: "apps" | "activity" | "profile";
  /** i18n key, resolved in the shell so the label follows the active locale. */
  labelKey: string;
  /** Material ligature; the bar draws it filled when active and outlined otherwise. */
  iconMd: string;
}

export const tabs: TabDefinition[] = [
  { id: "apps", labelKey: "tabs.apps", iconMd: "apps" },
  { id: "activity", labelKey: "tabs.activity", iconMd: "notifications" },
  { id: "profile", labelKey: "tabs.profile", iconMd: "person" },
];
