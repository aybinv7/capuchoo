const REPOSITORY = "https://github.com/aybinv7/capuchoo";

/** Every outbound link of the page, so a move of the repository or the dashboard is one edit. */
export const SITE = {
  name: "Capuchoo",
  dashboardUrl: import.meta.env.VITE_DASHBOARD_URL || "https://capuchoo-dashboard.onrender.com",
  repository: REPOSITORY,
  readme: `${REPOSITORY}#readme`,
  selfHosting: `${REPOSITORY}/blob/main/docs/SELF-HOSTING.md`,
  serverContract: `${REPOSITORY}/blob/main/docs/SERVER.md`,
  addingAnApp: `${REPOSITORY}/blob/main/docs/ADDING-AN-APP.md`,
  npmCli: "https://www.npmjs.com/package/@capuchoo/cli",
  npmUpdater: "https://www.npmjs.com/package/@capuchoo/updater",
} as const;

export const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Channels", href: "#channels" },
  { label: "Tour", href: "#tour" },
  { label: "Features", href: "#features" },
  { label: "CLI", href: "#cli" },
  { label: "Self-host", href: "#self-host" },
] as const;
