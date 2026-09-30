import { effectiveRole, roleRank, type AppRole, type Environment } from "@capuchoo/core";
import type { OrgRole } from "../db/schema";

const ORG_ORDER: readonly OrgRole[] = ["member", "admin", "owner"];

/** The account's own role on an app, before any API-key cap. */
export function accountAppRole(input: {
  isInstanceAdmin: boolean;
  orgRole: OrgRole | null;
  appRole: AppRole | null;
}): AppRole | null {
  if (input.isInstanceAdmin) return "admin";
  if (input.orgRole === "owner" || input.orgRole === "admin") return "admin";
  return input.appRole;
}

/** The role a request acts with: the account's role, lowered by the key's cap. */
export function actingRole(account: AppRole | null, keyCap: AppRole | null): AppRole | null {
  return effectiveRole(account, keyCap);
}

export function hasAppRole(role: AppRole | null, minimum: AppRole): boolean {
  return role !== null && roleRank(role) >= roleRank(minimum);
}

export function hasOrgRole(role: OrgRole | null, minimum: OrgRole): boolean {
  return role !== null && ORG_ORDER.indexOf(role) >= ORG_ORDER.indexOf(minimum);
}

/** The role needed to upload to or move the pointer of a channel in this environment. */
export function roleToDeliver(environment: Environment, prodRole: "admin" | "developer"): AppRole {
  return environment === "prod" ? prodRole : "developer";
}

export type AccessVerdict = { allow: true } | { allow: false; status: 403 | 404; message: string };

/** Whether a credential may act on an app at all, and with at least `minimum`. */
export function decideAppAccess(input: {
  role: AppRole | null;
  accountRole: AppRole | null;
  keyAppId: string | null;
  appId: string;
  minimum: AppRole;
  action: string;
}): AccessVerdict {
  if (input.keyAppId && input.keyAppId !== input.appId) {
    return { allow: false, status: 404, message: "App not found" };
  }
  if (!input.accountRole) return { allow: false, status: 404, message: "App not found" };
  if (!hasAppRole(input.role, input.minimum)) {
    const capped = input.role !== input.accountRole;
    return {
      allow: false,
      status: 403,
      message: capped
        ? `This API key is capped at ${input.role}; ${input.action} requires ${input.minimum}.`
        : `${input.action} requires ${input.minimum} on this app; you are ${input.role}.`,
    };
  }
  return { allow: true };
}
