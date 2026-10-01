export interface TabDefinition {
  /** Also the tab's DOM id and the first segment of its route. */
  id: "apps" | "activity" | "profile";
  /** i18n key, resolved in the shell so the label follows the active locale. */
  labelKey: string;
  /** Material icon name. */
  icon: string;
}

/** The three destinations of the M3 navigation bar. */
export const tabs: TabDefinition[] = [
  { id: "apps", labelKey: "tabs.apps", icon: "apps" },
  { id: "activity", labelKey: "tabs.activity", icon: "notifications" },
  { id: "profile", labelKey: "tabs.profile", icon: "account_circle" },
];
