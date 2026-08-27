import { Request, Response } from "express";
import {
  adoptionReparents,
  decideAppRegistration,
  describeAppConflict,
  type AppRegistration,
} from "@capuchoo/core";
import supabaseService from "@/services/supabaseService";
import logger from "@/utils/logger";

/** app_permissions.role, as the CHECK constraint defines it. */
const ROLES = ["admin", "developer", "tester", "viewer"];

class AppController {
  /**
   * Get all apps accessible to user
   * GET /api/apps
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Query apps manually based on permissions to avoid RPC issues with auth.uid() in backend

      // 1. Get direct app permissions
      const perms = await supabaseService.query("app_permissions", {
        select: "app_id",
        eq: { user_id: userId },
      });
      const directAppIds = (perms.data || []).map((p: any) => p.app_id);

      // 2. Get org admin memberships (Owners/Admins see all apps in those orgs)
      const { data: orgMembers, error: orgError } = await supabaseService
        .getClient()
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .in("role", ["owner", "admin"]);

      if (orgError) throw orgError;

      const orgIds = (orgMembers || []).map((o: any) => o.organization_id);

      if (directAppIds.length === 0 && orgIds.length === 0) {
        res.json([]);
        return;
      }

      // 4. Force API key scope if present
      const keyAppId = (req as any).appId;
      if (keyAppId) {
        const { data, error } = await supabaseService
          .getClient()
          .from("apps")
          .select("*")
          .eq("id", keyAppId)
          .single();

        if (error) throw error;
        res.json(data ? [data] : []);
        return;
      }

      // 3. Two queries, merged - not one `.or()` filter.
      //
      // PostgREST parses `or=(...)` by splitting on commas, so the commas inside
      // `id.in.(uuid,uuid)` are ambiguous and the filter mis-parses: this endpoint
      // silently returned a single app no matter how many the user could see,
      // which made every newly created app look like it had failed to save.
      // Asking twice and merging cannot be got wrong by a string.
      const client = supabaseService.getClient();

      const [byPermission, byOrganisation] = await Promise.all([
        directAppIds.length > 0
          ? client.from("apps").select("*").in("id", directAppIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        orgIds.length > 0
          ? client.from("apps").select("*").in("organization_id", orgIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      if (byPermission.error) throw byPermission.error;
      if (byOrganisation.error) throw byOrganisation.error;

      const unique = new Map<string, any>();
      for (const app of [...(byPermission.data ?? []), ...(byOrganisation.data ?? [])]) {
        unique.set(app.id, app);
      }

      res.json([...unique.values()]);
    } catch (error) {
      logger.error("List apps failed", { error });
      res.status(500).json({ error: "Failed to list apps" });
    }
  }

  /**
   * Get app details
   * GET /api/apps/:id
   */
  async get(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId && keyAppId !== id) {
        res.status(403).json({ error: "Forbidden: API key restricted to another app" });
        return;
      }

      const result = await supabaseService.query("apps", {
        select: "*",
        eq: { id },
      });

      if (!result.data || result.data.length === 0) {
        res.status(404).json({ error: "App not found" });
        return;
      }
      // TODO: Check permission again here?
      // Middleware should handle general auth, but permission specific to this app?
      // YES. Logic: can_access_app.

      res.json(result.data[0]);
    } catch (error) {
      logger.error("Get app failed", { error });
      res.status(500).json({ error: "Failed to get app" });
    }
  }

  /**
   * Create new app
   * POST /api/apps
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, app_id, organization_id, platform, icon_url } = req.body;
      const userId = (req as any).user?.id;

      if (!name || !app_id || !organization_id) {
        res.status(400).json({
          error: "Name, app_id and organization_id are required",
        });
        return;
      }

      const registration = await this.resolveRegistration(app_id, organization_id, userId);

      if (registration.kind === "conflict") {
        logger.warn("App registration refused", {
          app_id,
          requestedOrganizationId: organization_id,
          ownedBy: registration.app.organization_id,
        });
        res.status(409).json({ error: describeAppConflict(app_id), code: "app_id_taken" });
        return;
      }

      let app;
      let created = false;

      if (registration.kind === "adopt") {
        logger.info("Adopting an existing app row", {
          app_id,
          reason: registration.reason,
          appUuid: registration.app.id,
        });

        app = adoptionReparents(registration.reason)
          ? (
              await supabaseService.update(
                "apps",
                { organization_id, updated_at: new Date().toISOString() },
                { id: registration.app.id },
              )
            )[0]
          : (await supabaseService.query("apps", { select: "*", eq: { id: registration.app.id } }))
              .data?.[0];
      } else {
        const result = await supabaseService.insert("apps", {
          name,
          app_id,
          organization_id,
          platform: platform || "all",
          icon_url,
        });
        app = result[0];
        created = true;
      }

      // The creator is app admin. On adoption this may already exist, so it is an
      // upsert on the pair - a duplicate here used to abort a successful create.
      await supabaseService.upsert(
        "app_permissions",
        { app_id: app.id, user_id: userId, role: "admin" },
        { onConflict: "app_id,user_id" },
      );

      // `adopted` is not a column - it tells the caller its "create" returned a
      // row that already existed, so the CLI can say "linked" rather than
      // "created" and nobody goes looking for a duplicate.
      res.status(created ? 201 : 200).json(
        created
          ? app
          : {
              ...app,
              adopted: true,
              adoption_reason: (registration as { reason: string }).reason,
            },
      );
    } catch (error) {
      // A unique violation can still arrive: two inits racing between the lookup
      // and the insert. It is the caller's conflict, not a server fault.
      if ((error as { code?: string })?.code === "23505") {
        logger.warn("App registration lost a race", { app_id: req.body?.app_id });
        res
          .status(409)
          .json({ error: describeAppConflict(req.body?.app_id), code: "app_id_taken" });
        return;
      }

      logger.error("Create app failed", { error });
      res.status(500).json({ error: "Failed to create app" });
    }
  }

  /**
   * Looks up whatever already holds this bundle identifier and decides.
   *
   * Runs with the service client on purpose: the blocking row is one the caller
   * cannot see, so asking as the caller would report "free" and then fail on the
   * constraint - which is exactly the 500 this replaces.
   */
  private async resolveRegistration(
    appId: string,
    requestedOrganizationId: string,
    userId: string,
  ): Promise<AppRegistration> {
    const found = await supabaseService.query("apps", {
      select: "id, app_id, organization_id",
      eq: { app_id: appId },
    });
    const existing = found.data?.[0];

    if (!existing) return decideAppRegistration({ appId, requestedOrganizationId });

    const [organisation, permission] = await Promise.all([
      existing.organization_id
        ? supabaseService.query("organizations", {
            select: "id",
            eq: { id: existing.organization_id },
          })
        : Promise.resolve({ data: [] }),
      supabaseService.query("app_permissions", {
        select: "app_id",
        eq: { app_id: existing.id, user_id: userId },
      }),
    ]);

    return decideAppRegistration({
      appId,
      requestedOrganizationId,
      existing,
      existingOrganizationExists: (organisation.data ?? []).length > 0,
      callerHasDirectPermission: (permission.data ?? []).length > 0,
    });
  }

  /**
   * Update app
   * PUT /api/apps/:id
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId && keyAppId !== id) {
        res.status(403).json({ error: "Forbidden: API key restricted to another app" });
        return;
      }

      const { name, app_id, organization_id, platform, icon_url, config } = req.body;

      const dataToUpdate: any = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) dataToUpdate.name = name;
      if (app_id !== undefined) dataToUpdate.app_id = app_id;
      if (organization_id !== undefined) dataToUpdate.organization_id = organization_id;
      if (platform !== undefined) dataToUpdate.platform = platform;
      if (icon_url !== undefined) dataToUpdate.icon_url = icon_url;
      if (config !== undefined) dataToUpdate.config = config;

      const result = await supabaseService.update("apps", dataToUpdate, { id });

      if (!result || result.length === 0) {
        res.status(404).json({ error: "App not found" });
        return;
      }

      res.json(result[0]);
    } catch (error) {
      logger.error("Update app failed", { error });
      res.status(500).json({ error: "Failed to update app" });
    }
  }

  /**
   * Get app permissions
   * GET /api/apps/:id/permissions
   */
  async getPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId && keyAppId !== id) {
        res.status(403).json({ error: "Forbidden: API key restricted to another app" });
        return;
      }

      const { data, error } = await supabaseService
        .getClient()
        .from("app_permissions")
        .select("*, users(id, email, full_name, avatar_url)")
        .eq("app_id", id);

      if (error) throw error;
      res.json(data);
    } catch (error) {
      logger.error("Get app permissions failed", { error });
      res.status(500).json({ error: "Failed to get app permissions" });
    }
  }

  /**
   * Set app permission for a user
   * POST /api/apps/:id/permissions
   */
  async setPermission(req: Request, res: Response): Promise<void> {
    try {
      const { id: appId } = req.params;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId && keyAppId !== appId) {
        res.status(403).json({ error: "Forbidden: API key restricted to another app" });
        return;
      }

      // An email is accepted as well as a user_id, matching addMember on
      // organisations. A caller types an address, not a uuid, and there is
      // deliberately no user-lookup endpoint to turn one into the other -
      // that would be an email enumeration surface.
      const { role } = req.body;
      const email = req.body.email as string | undefined;
      let userId = req.body.user_id as string | undefined;

      if (!role || (!userId && !email)) {
        res.status(400).json({ error: "role and one of user_id or email are required" });
        return;
      }

      if (!userId && email) {
        const { data: user } = await supabaseService
          .getClient()
          .from("users")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (!user) {
          res.status(404).json({ error: `No account with the email "${email}"` });
          return;
        }
        userId = user.id;
      }

      if (!ROLES.includes(role)) {
        res.status(400).json({ error: `role must be one of ${ROLES.join(", ")}` });
        return;
      }

      // Upsert permission
      const { data, error } = await supabaseService
        .getClient()
        .from("app_permissions")
        .upsert(
          {
            app_id: appId,
            user_id: userId,
            role,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "app_id,user_id" },
        )
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      logger.error("Set app permission failed", { error });
      res.status(500).json({ error: "Failed to set app permission" });
    }
  }

  /**
   * Remove app permission for a user
   * DELETE /api/apps/:id/permissions/:userId
   */
  async removePermission(req: Request, res: Response): Promise<void> {
    try {
      const { id: appId, userId } = req.params;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId && keyAppId !== appId) {
        res.status(403).json({ error: "Forbidden: API key restricted to another app" });
        return;
      }

      const { error } = await supabaseService
        .getClient()
        .from("app_permissions")
        .delete()
        .match({ app_id: appId, user_id: userId });

      if (error) throw error;
      res.status(204).send();
    } catch (error) {
      logger.error("Remove app permission failed", { error });
      res.status(500).json({ error: "Failed to remove app permission" });
    }
  }

  /**
   * Delete app
   * DELETE /api/apps/:id
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId && keyAppId !== id) {
        res.status(403).json({ error: "Forbidden: API key restricted to another app" });
        return;
      }

      await supabaseService.delete("apps", { id });
      res.status(204).send();
    } catch (error) {
      logger.error("Delete app failed", { error });
      res.status(500).json({ error: "Failed to delete app" });
    }
  }
}

export default new AppController();
