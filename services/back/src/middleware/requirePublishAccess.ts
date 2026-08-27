import type { NextFunction, Request, Response } from "express";
import supabaseService from "@/services/supabaseService";
import logger from "@/utils/logger";
import type { AppRole } from "./checkAppAccess";
import type { OrgRole } from "./checkOrgAccess";
import { decidePublishAccess } from "./publish-access";

/**
 * Requires admin or developer on the app named by `app_id` in the request body.
 *
 * `checkAppAccess` cannot be used here: it reads the app from `req.params.id`,
 * and the publish endpoints carry a bundle identifier in the body instead. That
 * mismatch is why they ended up guarded by `authenticate` alone - they checked an
 * API key's app scope but never the account's role, so an unscoped key could
 * ship a required update to an app the account was only a viewer on.
 *
 * Sets `req.appId` to the resolved uuid, and `req.appRole`.
 */
export const requirePublishAccess = () => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id as string | undefined;
      const bundleId = (req.body?.app_id ?? req.body?.appId) as string | undefined;

      const appUuid = bundleId ? await resolveAppUuid(bundleId) : null;
      const grants = userId && appUuid ? await readGrants(userId, appUuid) : {};

      const decision = decidePublishAccess({
        userId,
        bundleId,
        appUuid,
        keyAppId: (req as any).appId as string | undefined,
        keyRole: (req as any).keyRole as AppRole | undefined,
        ...grants,
      });

      if (!decision.allow) {
        logger.warn("Publish denied", {
          userId,
          bundleId,
          status: decision.status,
          reason: decision.reason,
        });
        res.status(decision.status).json({ error: decision.reason });
        return;
      }

      (req as any).appId = decision.appUuid;
      (req as any).appRole = decision.role;
      next();
    } catch (error) {
      logger.error("Publish access check failed", { error });
      res.status(500).json({ error: "Authorization check failed" });
    }
  };
};

async function resolveAppUuid(bundleId: string): Promise<string | null> {
  const { data } = await supabaseService
    .getClient()
    .from("apps")
    .select("id")
    .eq("app_id", bundleId)
    .maybeSingle();

  return data?.id ?? null;
}

async function readGrants(
  userId: string,
  appUuid: string,
): Promise<{ appRole?: AppRole | null; orgRole?: OrgRole | null }> {
  const { data: permission } = await supabaseService
    .getClient()
    .from("app_permissions")
    .select("role")
    .eq("app_id", appUuid)
    .eq("user_id", userId)
    .maybeSingle();

  if (permission?.role) return { appRole: permission.role as AppRole };

  const { data: app } = await supabaseService
    .getClient()
    .from("apps")
    .select("organization_id")
    .eq("id", appUuid)
    .maybeSingle();

  if (!app?.organization_id) return { appRole: null, orgRole: null };

  const { data: member } = await supabaseService
    .getClient()
    .from("organization_members")
    .select("role")
    .eq("organization_id", app.organization_id)
    .eq("user_id", userId)
    .maybeSingle();

  return { appRole: null, orgRole: (member?.role as OrgRole) ?? null };
}
