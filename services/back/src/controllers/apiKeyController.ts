import { APP_ROLE_ORDER, canIssueCap, isAppRole } from "@capuchoo/core";
import { Request, Response, NextFunction } from "express";
import { randomBytes, createHash } from "crypto";
import supabaseService from "@/services/supabaseService";
import { AppError } from "@/types";

class ApiKeyController {
  /**
   * Generate a new API key
   * POST /api/api-keys
   */
  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new AppError("Unauthorized", 401);
      }

      // Optional: scope to specific app, and cap what the key may do
      const { name = "CLI Key", app_id } = req.body;
      const role = (req.body.role ?? null) as string | null;

      // A key may never mint a key with more reach than itself. Without this,
      // the app scope the deploy endpoints enforce is not a boundary: a key
      // restricted to one app could create an unscoped one and publish anywhere.
      // A dashboard session is unrestricted and stays that way.
      const callerScope = (req as any).appId as string | undefined;
      if (callerScope && app_id !== callerScope) {
        throw new AppError(
          "This API key is restricted to one application, so it can only create keys " +
            "for that same application. Create a broader key from the dashboard.",
          403,
        );
      }

      if (role !== null && !isAppRole(role)) {
        throw new AppError(`role must be one of ${APP_ROLE_ORDER.join(", ")}`, 400);
      }

      // A key may never mint one with more reach than itself, in role as well as
      // in app scope - otherwise a developer key could issue an admin key and
      // escape its own ceiling. A dashboard session has no cap and may issue any.
      const callerRole = (req as any).keyRole as string | undefined;
      if (!canIssueCap(isAppRole(callerRole) ? callerRole : null, role)) {
        throw new AppError(
          role === null
            ? "This API key is capped, so it cannot create an uncapped key. " +
                "Pass a role at or below its own ceiling."
            : `This API key is capped at ${callerRole}, so it cannot create a ${role} key.`,
          403,
        );
      }

      // Generate a random key: cap_<32 random hex chars>
      const randomPart = randomBytes(16).toString("hex");
      const plainKey = `cap_${randomPart}`;

      // Hash the key for storage
      const keyHash = createHash("sha256").update(plainKey).digest("hex");

      // Store first 12 chars as prefix for display
      const keyPrefix = plainKey.substring(0, 12);

      // Insert into database
      const { data, error } = await supabaseService
        .getAdminClient()
        .from("api_keys")
        .insert({
          user_id: user.id,
          name,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          app_id: app_id || null, // Optional app scope
          // Sent only when set. The column arrives with migration 007, and an
          // uncapped key - what `auth login` mints - must keep working before it.
          ...(role === null ? {} : { role }),
        })
        .select()
        .single();

      if (error) {
        throw new AppError(error.message, 500);
      }

      // Return the plain key ONLY ONCE
      res.status(201).json({
        success: true,
        message: "API key created. Copy it now - you won't see it again!",
        key: plainKey,
        id: data.id,
        name: data.name,
        prefix: keyPrefix,
        app_id: data.app_id,
        role: data.role,
        created_at: data.created_at,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List user's API keys (without the actual keys)
   * GET /api/api-keys
   */
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new AppError("Unauthorized", 401);
      }

      const { app_id } = req.query;

      let query = supabaseService
        .getAdminClient()
        .from("api_keys")
        .select("id, name, key_prefix, app_id, role, last_used_at, created_at")
        .eq("user_id", user.id);

      if (app_id) {
        query = query.eq("app_id", app_id);
      }

      const first = await query.order("created_at", { ascending: false });
      let data: unknown[] | null = first.data;

      if (first.error) {
        // Most likely the `role` column, which arrives with migration 007.
        const retry = await this.listWithoutCap(req);
        if (retry.error) throw new AppError(retry.error.message, 500);
        data = retry.data;
      }

      res.json({
        success: true,
        keys: data || [],
      });
    } catch (error) {
      next(error);
    }
  }

  /** The same listing without the cap column, for before migration 007 runs. */
  private async listWithoutCap(req: Request) {
    const user = (req as any).user;
    let query = supabaseService
      .getAdminClient()
      .from("api_keys")
      .select("id, name, key_prefix, app_id, last_used_at, created_at")
      .eq("user_id", user.id);

    const { app_id } = req.query;
    if (app_id) query = query.eq("app_id", app_id);

    return query.order("created_at", { ascending: false });
  }

  /**
   * Revoke an API key
   * DELETE /api/api-keys/:id
   */
  public async revoke(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new AppError("Unauthorized", 401);
      }

      const { id } = req.params;

      const { error } = await supabaseService
        .getAdminClient()
        .from("api_keys")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        throw new AppError(error.message, 500);
      }

      res.json({
        success: true,
        message: "API key revoked",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate an API key and return user info + app scope
   * Used internally by auth middleware
   */
  public async validateKey(apiKey: string): Promise<{ userId: string; appId?: string } | null> {
    try {
      const keyHash = createHash("sha256").update(apiKey).digest("hex");

      const { data, error } = await supabaseService
        .getClient()
        .from("api_keys")
        .select("id, user_id, app_id")
        .eq("key_hash", keyHash)
        .single();

      if (error || !data) {
        return null;
      }

      // Update last_used_at
      await supabaseService
        .getAdminClient()
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", data.id);

      return { userId: data.user_id, appId: data.app_id };
    } catch {
      return null;
    }
  }
}

export default new ApiKeyController();
