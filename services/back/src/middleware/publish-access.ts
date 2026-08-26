import type { AppRole } from "./checkAppAccess";
import type { OrgRole } from "./checkOrgAccess";

/** Roles allowed to ship code to devices. A tester or viewer may not. */
export const PUBLISH_ROLES: readonly AppRole[] = ["admin", "developer"];

export interface PublishRequest {
  userId?: string | undefined;
  /** Bundle identifier from the request body, e.g. `com.acme.app`. */
  bundleId?: string | undefined;
  /** Resolved app uuid, or null when no app carries that bundle id. */
  appUuid?: string | null | undefined;
  /** The app an API key is restricted to, if it is restricted at all. */
  keyAppId?: string | undefined;
  /** Role from `app_permissions`, if the account has a direct grant. */
  appRole?: AppRole | null | undefined;
  /** Role in the app's organization, if the account is a member. */
  orgRole?: OrgRole | null | undefined;
}

export type PublishDecision =
  | { allow: true; appUuid: string; role: AppRole }
  | { allow: false; status: 400 | 401 | 403 | 404; reason: string };

/** Org owners and admins get app-admin rights; a plain member gets nothing implicitly. */
function effectiveRole(request: PublishRequest): AppRole | null {
  if (request.appRole) return request.appRole;
  if (request.orgRole === "owner" || request.orgRole === "admin") return "admin";
  return null;
}

/**
 * Whether an account may publish to an app.
 *
 * Separated from the queries that feed it so the rule is testable without a
 * database. Key scope is checked before role so a restricted key gets the
 * message naming its restriction.
 */
export function decidePublishAccess(request: PublishRequest): PublishDecision {
  if (!request.userId) return { allow: false, status: 401, reason: "Unauthorized" };

  if (!request.bundleId) {
    return { allow: false, status: 400, reason: "app_id is required" };
  }

  if (!request.appUuid) {
    return {
      allow: false,
      status: 404,
      reason: `No application carries the bundle id "${request.bundleId}"`,
    };
  }

  if (request.keyAppId && request.keyAppId !== request.appUuid) {
    return {
      allow: false,
      status: 403,
      reason: "Forbidden: API key restricted to another app",
    };
  }

  const role = effectiveRole(request);

  if (!role) {
    return { allow: false, status: 403, reason: "No access to this app" };
  }

  if (!PUBLISH_ROLES.includes(role)) {
    return {
      allow: false,
      status: 403,
      reason:
        `Publishing requires ${PUBLISH_ROLES.join(" or ")} on this app; ` +
        `this account is ${role}.`,
    };
  }

  return { allow: true, appUuid: request.appUuid, role };
}
