import { roleRank, type AppRole, type Environment } from "@capuchoo/core";
import type { OrgRole, ProdRole } from "../types/session";
import { ALLOW, deny, type Gate } from "./gate";

/**
 * Mirrors of the server's policy (`services/server/src/access/policy.ts`) used only to decide what to
 * offer. The server re-checks every request; these never grant anything.
 */

const ORG_ORDER: readonly OrgRole[] = ["member", "admin", "owner"];

export function hasAppRole(role: AppRole | null | undefined, minimum: AppRole): boolean {
  return Boolean(role) && roleRank(role as AppRole) >= roleRank(minimum);
}

export function hasOrgRole(role: OrgRole | null | undefined, minimum: OrgRole): boolean {
  return Boolean(role) && ORG_ORDER.indexOf(role as OrgRole) >= ORG_ORDER.indexOf(minimum);
}

/** The role needed to move a pointer on a channel of this environment. */
export function roleToDeliver(environment: Environment, prodRole: ProdRole): AppRole {
  return environment === "prod" ? prodRole : "developer";
}

function describeRole(role: AppRole | null | undefined): string {
  return role ? `you are ${role}` : "you have no role on this app";
}

export function requireAppRole(
  role: AppRole | null | undefined,
  minimum: AppRole,
  action: string,
): Gate {
  return hasAppRole(role, minimum)
    ? ALLOW
    : deny(`${action} requires ${minimum}; ${describeRole(role)}.`);
}

/** Deliver, roll back, pause or resume on a channel of `environment`. */
export function canDeliver(
  role: AppRole | null | undefined,
  environment: Environment,
  prodRole: ProdRole,
): Gate {
  const needed = roleToDeliver(environment, prodRole);
  return hasAppRole(role, needed)
    ? ALLOW
    : deny(`Delivering to ${environment} requires ${needed}; ${describeRole(role)}.`);
}

/** Editing an artefact's notes or `required` flag: developer, and the deliver role for its flavour. */
export function canEditRelease(
  role: AppRole | null | undefined,
  flavour: Environment | null,
  prodRole: ProdRole,
): Gate {
  const base = requireAppRole(role, "developer", "Editing a release");
  if (!base.ok || !flavour) return base;
  const needed = roleToDeliver(flavour, prodRole);
  return hasAppRole(role, needed)
    ? ALLOW
    : deny(`Editing a ${flavour} release requires ${needed}; ${describeRole(role)}.`);
}

/** Assigning a device to a channel, or clearing its assignment when `environment` is null. */
export function canAssignDevice(
  role: AppRole | null | undefined,
  environment: Environment | null,
  prodRole: ProdRole,
): Gate {
  const base = requireAppRole(role, "developer", "Assigning a device");
  if (!base.ok || !environment) return base;
  return canDeliver(role, environment, prodRole);
}

export const canManageChannels = (role: AppRole | null | undefined): Gate =>
  requireAppRole(role, "admin", "Managing channels");

export const canDeleteRelease = (role: AppRole | null | undefined): Gate =>
  requireAppRole(role, "admin", "Deleting a release");

export const canRemoveDevice = (role: AppRole | null | undefined): Gate =>
  requireAppRole(role, "admin", "Removing a device");

export const canAdministerApp = (role: AppRole | null | undefined): Gate =>
  requireAppRole(role, "admin", "Administering the app");

/** Org membership changes. Owner-only rules (granting or removing ownership) stay with the server. */
export function canManageMembers(role: OrgRole | null | undefined): Gate {
  return hasOrgRole(role, "admin")
    ? ALLOW
    : deny(
        `Managing members requires the admin role in the organization; you are ${role ?? "not a member"}.`,
      );
}

export function canChangeOwnership(role: OrgRole | null | undefined): Gate {
  return role === "owner" ? ALLOW : deny("Only an owner can grant or change ownership.");
}

export function canCreateApp(role: OrgRole | null | undefined): Gate {
  return hasOrgRole(role, "admin")
    ? ALLOW
    : deny("Registering an app requires the admin role in the organization.");
}
