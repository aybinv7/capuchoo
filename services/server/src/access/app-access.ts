import type { AppRole, Environment } from "@capuchoo/core";
import { keyAppRestriction, keyRoleCap, type Principal } from "../auth/principal";
import type { Db } from "../db/database";
import type { App, OrgRole } from "../db/schema";
import { HttpError, forbidden, notFound } from "../lib/errors";
import { appRoleFor, findApp } from "../repositories/apps";
import { memberRole } from "../repositories/organizations";
import { accountAppRole, actingRole, decideAppAccess, hasOrgRole, roleToDeliver } from "./policy";

export interface AppAccess {
  app: App;
  orgRole: OrgRole | null;
  accountRole: AppRole | null;
  role: AppRole | null;
}

/** Loads an app and the caller's standing on it. Never throws for lack of access by itself. */
export async function loadAppAccess(
  db: Db,
  principal: Principal,
  reference: string,
): Promise<AppAccess | null> {
  const app = await findApp(db, reference);
  if (!app) return null;
  const [orgRole, appRole] = await Promise.all([
    memberRole(db, app.organization_id, principal.userId),
    appRoleFor(db, app.id, principal.userId),
  ]);
  const accountRole = accountAppRole({
    isInstanceAdmin: principal.isInstanceAdmin,
    orgRole,
    appRole,
  });
  return { app, orgRole, accountRole, role: actingRole(accountRole, keyRoleCap(principal)) };
}

/**
 * The app, if the caller holds at least `minimum` on it. An app the caller cannot see at all is a
 * 404 rather than a 403, so ids cannot be probed.
 */
export async function requireApp(
  db: Db,
  principal: Principal,
  reference: string,
  minimum: AppRole,
  action: string,
): Promise<AppAccess> {
  const access = await loadAppAccess(db, principal, reference);
  if (!access) throw notFound("App");
  const verdict = decideAppAccess({
    role: access.role,
    accountRole: access.accountRole,
    keyAppId: keyAppRestriction(principal),
    appId: access.app.id,
    minimum,
    action,
  });
  if (!verdict.allow)
    throw new HttpError(
      verdict.status,
      verdict.message,
      verdict.status === 404 ? "not_found" : "forbidden",
    );
  return access;
}

/** Requires the role needed to deliver to a channel of this environment. */
export function requireDeliverRole(
  access: AppAccess,
  environment: Environment,
  action: string,
): void {
  const needed = roleToDeliver(environment, access.app.prod_role);
  const verdict = decideAppAccess({
    role: access.role,
    accountRole: access.accountRole,
    keyAppId: null,
    appId: access.app.id,
    minimum: needed,
    action: `${action} on a ${environment} channel`,
  });
  if (!verdict.allow) throw forbidden(verdict.message);
}

/** Org-level administration needs an org role and a credential that is not limited to one app or capped below admin. */
export async function requireOrgRole(
  db: Db,
  principal: Principal,
  organizationId: string,
  minimum: OrgRole,
): Promise<OrgRole> {
  const role = principal.isInstanceAdmin
    ? "owner"
    : await memberRole(db, organizationId, principal.userId);
  if (!role) throw notFound("Organization");
  if (!hasOrgRole(role, minimum))
    throw forbidden(`This needs the ${minimum} role in the organization; you are ${role}.`);
  if (minimum !== "member") {
    if (keyAppRestriction(principal))
      throw forbidden("An API key limited to one app cannot manage the organization.");
    const cap = keyRoleCap(principal);
    if (cap && cap !== "admin")
      throw forbidden(`This API key is capped at ${cap} and cannot manage the organization.`);
  }
  return role;
}
