import type { AppRole } from "./checkAppAccess";
import { Request, Response, NextFunction } from "express";
import supabaseService from "@/services/supabaseService";
import logger from "@/utils/logger";
import { decideResourceAccess } from "./resource-access";

/**
 * Authorization for the resources addressed by their own id.
 *
 * `/api/dashboard/channels/:id` and `/api/dashboard/bundles/:id` were mounted
 * behind `authenticate` and nothing else, and their handlers filtered by `id`
 * alone. Any authenticated account could therefore read, edit or delete any
 * channel or bundle in any organization by guessing - or simply knowing - a
 * uuid. `checkAppAccess` already existed for the `/api/apps/:id` routes; these
 * resources hang off an app, so they need the same decision made about the app
 * they belong to.
 *
 * The row's `app_id` is resolved first, then three things are checked: the
 * resource exists, an app-scoped API key is not reaching outside its app, and
 * the account has access to that app.
 */

/** True when the user has direct permission on the app, or admins its org. */
/** The account's effective role on an app, or null when it has none. */
export async function appRoleFor(userId: string, appUuid: string): Promise<AppRole | null> {
  const { data: permission } = await supabaseService
    .getClient()
    .from("app_permissions")
    .select("role")
    .eq("app_id", appUuid)
    .eq("user_id", userId)
    .maybeSingle();

  if (permission?.role) return permission.role as AppRole;

  const { data: app } = await supabaseService
    .getClient()
    .from("apps")
    .select("organization_id")
    .eq("id", appUuid)
    .maybeSingle();

  if (!app?.organization_id) return null;

  const { data: orgMember } = await supabaseService
    .getClient()
    .from("organization_members")
    .select("role")
    .eq("organization_id", app.organization_id)
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  return orgMember ? "admin" : null;
}

/** Guards a resource that belongs to an app, addressed as `:id`. */
export const checkResourceAccess = (
  table: "channels" | "app_versions",
  requiredRoles?: readonly AppRole[],
) => {
  const noun = table === "channels" ? "Channel" : "Bundle";

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id as string | undefined;
      const id = req.params.id;

      // Both queries are skipped when the request cannot pass anyway, so an
      // unauthenticated caller costs nothing.
      let resourceAppId: string | null = null;
      let role: AppRole | null = null;

      if (userId && id) {
        const { data: row } = await supabaseService
          .getClient()
          .from(table)
          .select("app_id")
          .eq("id", id)
          .maybeSingle();

        resourceAppId = row?.app_id ?? null;
        if (resourceAppId) role = await appRoleFor(userId, resourceAppId);
      }

      const decision = decideResourceAccess(
        {
          userId,
          resourceId: id,
          resourceAppId,
          keyAppId: (req as any).appId as string | undefined,
          permitted: role !== null,
          role,
          requiredRoles,
        },
        noun,
      );

      if (!decision.allow) {
        if (decision.status === 403) {
          logger.warn("Resource access denied", { userId, table, id, reason: decision.reason });
        }
        res
          .status(decision.status)
          .json(
            decision.status === 403 && decision.reason.startsWith("This API key")
              ? { error: "Forbidden", message: decision.reason }
              : { error: decision.reason },
          );
        return;
      }

      (req as any).resourceAppId = decision.appId;
      next();
    } catch (error) {
      logger.error("Resource access check error", { error, table });
      res.status(500).json({ error: "Authorization check failed" });
    }
  };
};
