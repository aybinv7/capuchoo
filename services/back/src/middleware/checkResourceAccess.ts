import { Request, Response, NextFunction } from "express";
import supabaseService from "@/services/supabaseService";
import logger from "@/utils/logger";

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
export async function hasAppAccess(userId: string, appUuid: string): Promise<boolean> {
  const { data: permission } = await supabaseService
    .getClient()
    .from("app_permissions")
    .select("role")
    .eq("app_id", appUuid)
    .eq("user_id", userId)
    .maybeSingle();

  if (permission) return true;

  const { data: app } = await supabaseService
    .getClient()
    .from("apps")
    .select("organization_id")
    .eq("id", appUuid)
    .maybeSingle();

  if (!app) return false;

  const { data: orgMember } = await supabaseService
    .getClient()
    .from("organization_members")
    .select("role")
    .eq("organization_id", app.organization_id)
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  return Boolean(orgMember);
}

/** Guards a resource that belongs to an app, addressed as `:id`. */
export const checkResourceAccess = (table: "channels" | "app_versions") => {
  const noun = table === "channels" ? "Channel" : "Bundle";

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const id = req.params.id;
      if (!id) {
        res.status(400).json({ error: `${noun} id is required` });
        return;
      }

      const { data: row } = await supabaseService
        .getClient()
        .from(table)
        .select("app_id")
        .eq("id", id)
        .maybeSingle();

      if (!row?.app_id) {
        res.status(404).json({ error: `${noun} not found` });
        return;
      }

      // An app-scoped API key must not reach another app's resources, the same
      // rule the upload endpoints enforce.
      const keyAppId = (req as any).appId as string | undefined;
      if (keyAppId && keyAppId !== row.app_id) {
        logger.warn("API key app scope mismatch", { keyAppId, table, id });
        res.status(403).json({
          error: "Forbidden",
          message: "This API key is restricted to another application.",
        });
        return;
      }

      if (!(await hasAppAccess(userId, row.app_id))) {
        logger.warn("Resource access denied", { userId, table, id });
        res.status(403).json({ error: `No access to this ${noun.toLowerCase()}` });
        return;
      }

      (req as any).resourceAppId = row.app_id;
      next();
    } catch (error) {
      logger.error("Resource access check error", { error, table });
      res.status(500).json({ error: "Authorization check failed" });
    }
  };
};
