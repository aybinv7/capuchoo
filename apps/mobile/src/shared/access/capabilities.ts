import { roleRank, type AppRole } from "@capuchoo/core";
import type { Environment } from "@/shared/database/schema";
import { viewedRole } from "./viewAs";

/** Every check reads the viewed role, so a role preview narrows every screen at once. */
const atLeast = (role: AppRole, minimum: AppRole): boolean =>
  roleRank(viewedRole(role)) >= roleRank(minimum);

export interface AppAccess {
  role: AppRole;
  prod_role: AppRole;
}

function mayDeliver(app: AppAccess, environment: Environment | null): boolean {
  return environment === "prod" || environment === null
    ? atLeast(app.role, "developer") && atLeast(app.role, app.prod_role)
    : atLeast(app.role, "developer");
}

/**
 * What this account may do on an app, mirroring the server's own rules
 * (`services/server/src/access/policy.ts`) so a button is never offered that the server would
 * refuse. The server still decides; this only keeps the screen honest.
 */
export const can = {
  /** Download and install builds on this phone. The server lets a viewer fetch a link; testing is the tester's job. */
  install: (app: AppAccess): boolean => atLeast(app.role, "tester"),

  /** Point, roll back, pause or resume a channel of this environment. */
  deliver: (app: AppAccess, environment: Environment | null): boolean =>
    mayDeliver(app, environment),

  /** Override the channel a device follows; clearing the override needs only a developer. */
  assignDevice: (app: AppAccess, environment: Environment | null | undefined): boolean =>
    environment === undefined ? atLeast(app.role, "developer") : mayDeliver(app, environment),

  /** Forget a device; it registers again the next time it checks for an update. */
  removeDevice: (app: AppAccess): boolean => atLeast(app.role, "admin"),

  /** Statistics and channels: the release desk, a developer's view and up. */
  seeReleases: (app: AppAccess): boolean => atLeast(app.role, "developer"),

  /** Give and take roles on the app, and invite people to its organization. */
  manageAccess: (app: AppAccess): boolean => atLeast(app.role, "admin"),
};
