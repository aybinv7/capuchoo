import { Request, Response } from "express";
import { isValidBundleId } from "@capuchoo/core";
import supabaseService from "@/services/supabaseService";
import logger from "@/utils/logger";
import { uniqueSlug } from "@/utils/slug";
import { User } from "@supabase/supabase-js";

/**
 * Platforms the wizard may report. Capuchoo exists for Capacitor apps, so
 * "capacitor" is the common answer and was previously rejected outright - the
 * wizard's own default value could not complete onboarding.
 */
const PLATFORMS = ["capacitor", "android", "ios"] as const;

class OnboardingController {
  async complete(req: Request, res: Response) {
    const user = (req as any).user as User;
    const { organization, app } = req.body;

    if (!user || !user.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!organization || !app) {
      return res.status(400).json({ error: "Missing required onboarding data" });
    }

    const { name: orgName } = organization;
    const { name: appName, platform: appPlatform } = app;
    // The bundle identifier is the app's identity everywhere else: devices send
    // it on every check and the CLI resolves the app by it. It used to be
    // *derived* from the display name - `com.${name.replace(/\s+/g, "-")}` -
    // which produced identifiers no device would ever send, and which
    // isValidBundleId rejects outright when the name contains a space.
    const appBundleId: string | undefined = app.appId ?? app.app_id;

    if (!orgName || !appName || !appPlatform) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!PLATFORMS.includes(appPlatform)) {
      return res
        .status(400)
        .json({ error: `Invalid app platform. Expected one of: ${PLATFORMS.join(", ")}` });
    }

    if (!appBundleId || !isValidBundleId(appBundleId)) {
      return res.status(400).json({
        error:
          "A valid bundle identifier is required, e.g. com.company.app - " +
          "lower case, at least two dot-separated segments, no hyphens",
      });
    }

    const supabase = supabaseService.getClient();

    try {
      // 1. Create Organization
      // `slug` is UNIQUE NOT NULL, and this insert omitted it - so onboarding
      // could not have succeeded even with a valid platform.
      const slug = await uniqueSlug(orgName, async (candidate) => {
        const { data } = await supabase
          .from("organizations")
          .select("id")
          .eq("slug", candidate)
          .maybeSingle();
        return Boolean(data);
      });

      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: orgName,
          slug,
        })
        .select()
        .single();

      if (orgError) throw new Error(`Organization creation failed: ${orgError.message}`);
      const orgId = orgData.id;

      // 2. Add User as Organization Member (Owner)
      const { error: memberError } = await supabase.from("organization_members").insert({
        organization_id: orgId,
        user_id: user.id,
        role: "owner",
      });

      if (memberError) {
        // Cleanup: Delete org if member addition fails
        await supabase.from("organizations").delete().eq("id", orgId);
        throw new Error(`Failed to add member to organization: ${memberError.message}`);
      }

      // 3. Create App
      const { data: appData, error: appError } = await supabase
        .from("apps")
        .insert({
          name: appName,
          app_id: appBundleId,
          organization_id: orgId,
          platform: appPlatform,
        })
        .select()
        .single();

      if (appError) {
        // Cleanup: Delete org (cascades)
        await supabase.from("organizations").delete().eq("id", orgId);
        throw new Error(`App creation failed: ${appError.message}`);
      }

      // 5. Add App Permission (Admin)
      const { error: permError } = await supabase.from("app_permissions").insert({
        app_id: appData.id,
        user_id: user.id,
        role: "admin",
      });

      if (permError) {
        // Not fatal: the creator is the organisation's owner, and app listing
        // grants access through org membership as well as app_permissions. Worth
        // a warning rather than silence, because the two paths disagreeing is
        // how an app becomes invisible to the person who just made it.
        logger.warn("Onboarding created the app without an app_permissions row", {
          appId: appData.id,
          userId: user.id,
          error: permError.message,
        });
      }

      logger.info("Onboarding completed successfully", {
        userId: user.id,
        orgId: orgId,
        appId: appData.id,
      });

      return res.status(201).json({
        organization: orgData,
        app: appData,
      });
    } catch (error: any) {
      logger.error("Onboarding failed", { error: error.message });
      return res.status(500).json({ error: error.message || "Failed to complete onboarding" });
    }
  }
}

export default new OnboardingController();
