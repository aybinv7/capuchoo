import type { AppRole } from "./checkAppAccess";

/**
 * The authorization rule for resources addressed by their own id, with no I/O.
 *
 * `/api/dashboard/channels/:id` and `/bundles/:id` used to filter by `id` alone,
 * so any authenticated account could read, edit or delete another
 * organization's channel or bundle by uuid. That rule now lives here, separate
 * from the queries that feed it, so it can be tested without a database - and
 * `middleware/` keeps doing the I/O.
 */

export interface AccessRequest {
  userId?: string | undefined;
  /** The `:id` from the route. */
  resourceId?: string | undefined;
  /** `app_id` of the row, or null when no such row exists. */
  resourceAppId?: string | null | undefined;
  /** The app an API key is restricted to, if it is restricted at all. */
  keyAppId?: string | undefined;
  /** Whether the account has permission on the resource's app. */
  permitted?: boolean | undefined;
  /** The account's effective role on that app, when one is needed. */
  role?: AppRole | null | undefined;
  /** Roles allowed to perform this operation. Omitted means any access will do. */
  requiredRoles?: readonly AppRole[] | undefined;
}

export type AccessDecision =
  | { allow: true; appId: string }
  | { allow: false; status: 400 | 401 | 403 | 404; reason: string };

/**
 * The decision itself, separated from the two queries that feed it so it can be
 * tested without a database. Order matters: a missing row is a 404 before any
 * scope question, and the key's scope is checked before the account's
 * permissions so a restricted key gets the message naming the restriction.
 */
export function decideResourceAccess(request: AccessRequest, noun: string): AccessDecision {
  if (!request.userId) return { allow: false, status: 401, reason: "Unauthorized" };
  if (!request.resourceId) {
    return { allow: false, status: 400, reason: `${noun} id is required` };
  }
  if (!request.resourceAppId) {
    return { allow: false, status: 404, reason: `${noun} not found` };
  }
  if (request.keyAppId && request.keyAppId !== request.resourceAppId) {
    return {
      allow: false,
      status: 403,
      reason: "This API key is restricted to another application.",
    };
  }
  if (!request.permitted) {
    return { allow: false, status: 403, reason: `No access to this ${noun.toLowerCase()}` };
  }
  if (request.requiredRoles && !request.requiredRoles.includes(request.role as AppRole)) {
    return {
      allow: false,
      status: 403,
      reason:
        `This operation requires ${request.requiredRoles.join(" or ")} on the app; ` +
        `this account is ${request.role ?? "unassigned"}.`,
    };
  }
  return { allow: true, appId: request.resourceAppId };
}
