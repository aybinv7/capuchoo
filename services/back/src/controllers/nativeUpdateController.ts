import { isFlavour, parseUpdateEvent } from "@capuchoo/core";
import { Request, Response } from "express";
import {
  NativeUpdateRecord,
  NativeUpdateLogRecord,
  ValidationError,
  IFileService,
  ISupabaseService,
} from "@/types";
import config from "@/config";
import fileService from "@/services/fileService";
import { assertFlavourMatchesChannel, insertTolerantOfFlavour } from "@/services/flavourGuard";
import supabaseService from "@/services/supabaseService";
import deviceService from "@/services/deviceService";
import updateService from "@/services/updateService";
import logger from "@/utils/logger";
import semver from "semver";
import multer from "multer";
import * as fs from "fs";

/**
 * Controller for handling native update operations (APK/IPA files)
 */
class NativeUpdateController {
  constructor(
    private readonly fileService: IFileService,
    private readonly supabaseService: ISupabaseService,
  ) {}

  /**
   * Resolve string App ID (e.g. "com.example.app") to UUID
   */
  private async resolveAppUuid(appIdString: string): Promise<string | null> {
    try {
      const { data: appData, error } = await this.supabaseService
        .getClient()
        .from("apps")
        .select("id")
        .eq("app_id", appIdString)
        .maybeSingle();

      if (error) {
        logger.error("Error resolving app UUID", { appIdString, error });
        return null;
      }

      return appData ? appData.id : null;
    } catch (error) {
      logger.error("Failed to resolve app UUID", { appIdString, error });
      return null;
    }
  }

  /**
   * Check for available native update
   * GET /api/native-updates/check
   */
  async checkNativeUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { platform, channel = "stable", current_version_code } = req.query;

      if (!platform || current_version_code === undefined) {
        throw new ValidationError("Missing required parameters: platform, current_version_code");
      }

      if (!["android", "ios"].includes(platform as string)) {
        throw new ValidationError("Invalid platform. Must be: android, ios");
      }

      const versionCode = parseInt(current_version_code as string, 10);
      if (isNaN(versionCode)) {
        throw new ValidationError("current_version_code must be a number");
      }

      logger.info("Checking for native update", {
        platform,
        channel,
        current_version_code: versionCode,
      });

      // Query for a newer version
      const result = await this.supabaseService.query<NativeUpdateRecord>("native_updates", {
        select: "*",
        eq: {
          platform,
          channel,
          active: true,
        },
        gt: { version_code: versionCode },
        order: { column: "version_code", ascending: false },
        limit: 1,
      });

      if (result.data && result.data.length > 0) {
        logger.info("Native update available", {
          platform,
          newVersion: result.data?.[0]?.version_name,
          newVersionCode: result.data?.[0]?.version_code,
        });

        res.json({
          available: true,
          update: result.data[0],
        });
      } else {
        res.json({
          available: false,
          update: null,
        });
      }
    } catch (error) {
      logger.error("Native update check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to check for native update" });
      }
    }
  }

  /**
   * Log native update event
   * POST /api/native-updates/log
   */
  async logNativeUpdate(req: Request, res: Response): Promise<void> {
    try {
      // Parsed by the shared contract rather than destructured here. The two
      // sides had drifted twice over: the runtime never sent an app id at all,
      // so this endpoint answered 400 to every native event ever posted to it,
      // and it sent failure detail as `error` while this read `error_message`.
      const parsed = parseUpdateEvent(req.body as Record<string, unknown>);

      if (!parsed.ok) {
        throw new ValidationError(`Missing required parameters: ${parsed.missing.join(", ")}`);
      }

      const {
        event,
        platform,
        device_id,
        current_version_code,
        new_version,
        new_version_code,
        channel,
        error: error_message,
      } = parsed.event;

      // native_update_logs.app_id is NOT NULL and its device_id is a foreign
      // key into devices(id) - not the plugin's device string. Both were wrong,
      // so every insert on this endpoint was rejected.
      const appUuid = await updateService.resolveAppUuid(parsed.event.app_id);

      if (!appUuid) {
        throw new ValidationError(`No app carries the bundle id "${parsed.event.app_id}"`);
      }

      const channelId = channel ? await deviceService.resolveChannelId(appUuid, channel) : null;

      const device = device_id
        ? await deviceService.registerDevice({
            appUuid,
            deviceId: device_id,
            platform,
            channelId,
            channelOverride: channel,
            versionBuild:
              current_version_code !== undefined && current_version_code !== null
                ? String(current_version_code)
                : undefined,
            versionOs: req.body.version_os || req.body.versionOs,
            pluginVersion: req.body.plugin_version || req.body.pluginVersion,
          })
        : null;

      // Spread rather than assigned: under exactOptionalPropertyTypes an
      // explicit `undefined` is not the same as an absent key, and the parsed
      // event reports absence as undefined.
      const logRecord: NativeUpdateLogRecord = {
        app_id: appUuid,
        event,
        platform,
        current_version_code,
        channel,
        ...(new_version === undefined ? {} : { new_version }),
        ...(new_version_code === undefined ? {} : { new_version_code }),
        ...(error_message === undefined ? {} : { error_message }),
        ...(device ? { device_id: device.id } : {}),
      };

      // Best-effort from here down, and deliberately so.
      //
      // This endpoint is bookkeeping. A device calls it after downloading and
      // after installing, and it can do nothing useful with a failure - so a
      // failure here must never look like one to the caller. It did: the event
      // column's CHECK constraint rejected `download_complete`, the insert
      // threw, and the most common event a device sends answered 500. The same
      // reasoning already governs recordDeviceActivity in updateService, where
      // a telemetry error used to surface as a device that could not update.
      let recorded = true;

      try {
        await this.supabaseService.insert("native_update_logs", [logRecord]);

        if (device && channelId) {
          await deviceService.linkChannel(device.id, channelId, platform);
        }
      } catch (error) {
        recorded = false;
        logger.error("Could not record native update event", {
          event,
          appId: parsed.event.app_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      logger.info("Native update event handled", {
        event,
        platform,
        device_id,
        deviceUuid: device?.id ?? null,
        recorded,
      });

      // `recorded` is reported rather than hidden: the caller ignores it, but
      // it is the difference between "we stored this" and "we accepted it" when
      // someone is reading a response by hand.
      res.json({ success: true, recorded });
    } catch (error) {
      logger.error("Native update log failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to log native update event" });
      }
    }
  }

  /**
   * Upload a new native update (APK/IPA)
   * POST /api/admin/native-upload
   */
  async uploadNativeUpdate(req: Request, res: Response): Promise<void> {
    try {
      const {
        version,
        version_name, // Added version_name
        version_code,
        platform,
        channel = "stable",
        required = false,
        active = false,
        release_notes,
        app_id,
        flavour,
      } = req.body;

      // Prioritize version_name if provided, otherwise use version
      const finalVersion = version_name || version;

      logger.info("Native upload request received", {
        version: finalVersion, // Use finalVersion for logging
        version_code,
        platform,
        channel,
        required,
        file: req.file
          ? {
              originalName: req.file.originalname,
              size: req.file.size,
              mimetype: req.file.mimetype,
            }
          : null,
      });

      // Validate file
      if (!req.file) {
        throw new ValidationError("No file uploaded");
      }

      // Validate required fields
      if (!finalVersion || !version_code || !platform) {
        throw new ValidationError("Missing required parameters: version, version_code, platform");
      }

      if (!semver.valid(finalVersion)) {
        throw new ValidationError("Version must follow semantic versioning (e.g. 1.2.3)");
      }

      if (!["android", "ios"].includes(platform)) {
        throw new ValidationError("Invalid platform. Must be: android, ios");
      }

      // Resolve the app UUID from bundle identifier if provided
      const appUuid = app_id ? await this.resolveAppUuid(app_id as string) : null;

      if (!appUuid) {
        throw new ValidationError("Valid App ID is required");
      }

      // Security Check: If API key is scoped to a specific app, ensure it matches
      const keyAppId = (req as any).appId;
      if (keyAppId && keyAppId !== appUuid) {
        logger.warn("Security breach attempt: API key app scope mismatch", {
          keyAppId,
          targetAppUuid: appUuid,
          userId: (req as any).user?.id,
        });
        res.status(403).json({
          error: "Forbidden",
          message: "This API key is restricted to another application.",
        });
        return;
      }

      await assertFlavourMatchesChannel(appUuid, channel || "prod", flavour);

      const versionCodeNum = parseInt(version_code, 10);
      if (isNaN(versionCodeNum) || versionCodeNum < 1) {
        throw new ValidationError("version_code must be a positive integer");
      }

      // Validate file extension
      const ext = req.file.originalname.toLowerCase().split(".").pop();
      if (platform === "android" && ext !== "apk") {
        throw new ValidationError("Android platform requires an APK file");
      }
      if (platform === "ios" && ext !== "ipa") {
        throw new ValidationError("iOS platform requires an IPA file");
      }

      // Calculate checksum
      const buffer = req.file.buffer || fs.readFileSync(req.file.path);
      const checksum = this.fileService.calculateChecksum(buffer);

      // Upload file with native prefix
      const fileName = `native/${appUuid}/${platform}/${channel}/v${versionCodeNum}-${finalVersion}.${ext}`;
      const downloadUrl = await this.supabaseService
        .getClient()
        .storage.from(config.supabase.bucketName)
        .upload(fileName, buffer, {
          contentType:
            platform === "android"
              ? "application/vnd.android.package-archive"
              : "application/octet-stream",
          upsert: false,
        })
        .then(async ({ error }: { error: Error | null }) => {
          if (error) throw error;
          const { data: urlData } = this.supabaseService
            .getClient()
            .storage.from(config.supabase.bucketName)
            .getPublicUrl(fileName);
          return urlData.publicUrl;
        });

      // Create database record
      const updateRecord: Omit<NativeUpdateRecord, "id"> = {
        app_id: appUuid,
        platform: platform as "android" | "ios",
        version_name: finalVersion,
        version_code: versionCodeNum,
        download_url: downloadUrl,
        checksum,
        channel,
        required: required === "true" || required === true,
        // Multipart form fields arrive as strings, so `active` is compared the
        // same way `required` is. This used to be hardcoded false, which meant
        // `deploy native --active` uploaded an APK that nothing would ever
        // serve.
        active: active === "true" || active === true,
        file_size_bytes: req.file.size,
        release_notes: release_notes || null,
        ...(isFlavour(flavour) ? { flavour } : {}),
      };

      const insertedRecord = await insertTolerantOfFlavour(
        "native_updates",
        updateRecord as unknown as Record<string, unknown>,
      );

      // Serving a native update is decided by `channels.current_native_version_id`
      // and nothing else - `active` on the row alone means "publishable". Without
      // this the APK uploaded, downloaded fine by URL, and was offered to no
      // device: exactly the defect the OTA upload had.
      if (updateRecord.active && insertedRecord[0]?.id) {
        const { error: pointerError } = await this.supabaseService
          .getClient()
          .from("channels")
          .update({
            current_native_version_id: insertedRecord[0].id,
            updated_at: new Date().toISOString(),
          })
          .eq("app_id", appUuid)
          .eq("name", channel);

        if (pointerError) {
          // The artefact is stored and the row exists, so this is recoverable by
          // re-activating - but it must not be reported as a successful release.
          logger.error("Native update stored but the channel was not pointed at it", {
            channel,
            recordId: insertedRecord[0].id,
            error: pointerError,
          });
          throw new Error(
            `Uploaded, but channel "${channel}" still serves its previous native version: ` +
              pointerError.message,
          );
        }

        logger.info("Channel now serves this native version", {
          channel,
          recordId: insertedRecord[0].id,
        });
      }

      logger.info("Native update uploaded successfully", {
        version_name: finalVersion,
        version_code: versionCodeNum,
        platform,
        fileName,
        downloadUrl,
        recordId: insertedRecord[0]?.id,
      });

      res.json({
        success: true,
        message: `Native update v${finalVersion} (code: ${versionCodeNum}) uploaded successfully`,
        downloadUrl,
        fileName,
        record: insertedRecord[0],
      });
    } catch (error) {
      logger.error("Native upload failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({
          error: "Upload failed",
          details: (error as Error).message,
        });
      }
    }
  }

  /**
   * Get all native updates for dashboard
   * GET /api/dashboard/native-updates
   */
  async getNativeUpdates(req: Request, res: Response): Promise<void> {
    try {
      const { app_id } = req.query;

      // Resolve app UUID if identifier provided
      let appUuid = app_id ? await this.resolveAppUuid(app_id as string) : null;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId) {
        if (appUuid && keyAppId !== appUuid) {
          res.status(403).json({ error: "Forbidden: API key restricted to another app" });
          return;
        }
        appUuid = keyAppId;
      }

      let query = this.supabaseService
        .getClient()
        .from("native_updates")
        .select("*, apps(app_id)")
        .order("created_at", { ascending: false });

      if (appUuid) {
        query = query.eq("app_id", appUuid);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch channels to identify which native updates are currently "active" (live)
      const { data: channels } = await this.supabaseService
        .getClient()
        .from("channels")
        .select("name, current_native_version_id")
        .eq("app_id", appUuid);

      const results = (data || []).map((update: any) => ({
        ...update,
        app_bundle_id: update.apps?.app_id,
        is_active_for: (channels || [])
          .filter((ch: any) => ch.current_native_version_id === update.id)
          .map((ch: any) => ch.name),
      }));

      res.json(results);
    } catch (error) {
      logger.error("Native updates fetch failed", { error });
      res.status(500).json({ error: "Failed to fetch native updates" });
    }
  }

  /**
   * Update a native update record
   * PUT /api/dashboard/native-updates/:id
   */
  async updateNativeUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await this.supabaseService.update("native_updates", updateData, { id });

      if (result.length === 0) {
        throw new ValidationError("Native update not found");
      }

      res.json(result[0]);
    } catch (error) {
      logger.error("Native update modification failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to update native update" });
      }
    }
  }

  /**
   * Delete a native update
   * DELETE /api/dashboard/native-updates/:id
   */
  async deleteNativeUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Refused rather than performed, when a channel is actively serving this
      // binary. `findAssignedNative` does a `.maybeSingle()` lookup by id and
      // returns null on a miss - so deleting one a channel points at does not
      // error anywhere, it just makes that channel silently stop offering it,
      // and every OTA bundle gated behind it becomes unsatisfiable the same
      // way `assertNativeGateSatisfiable` exists to prevent at upload time.
      const { data: servingChannels } = await this.supabaseService
        .getClient()
        .from("channels")
        .select("name")
        .eq("current_native_version_id", id);

      if (servingChannels && servingChannels.length > 0) {
        const names = servingChannels.map((c: any) => c.name).join(", ");
        throw new ValidationError(
          `Cannot delete: this native build is currently served by ${names}. ` +
            `Point ${servingChannels.length === 1 ? "that channel" : "those channels"} ` +
            `at a different release first.`,
        );
      }

      await this.supabaseService.delete("native_updates", {
        id,
      });
      res.status(204).send();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      logger.error("Native update deletion failed", { error });
      res.status(500).json({ error: "Failed to delete native update" });
    }
  }

  /**
   * Get multer upload middleware for native files
   */
  getUploadMiddleware(): any {
    const storage = multer.memoryStorage();
    const upload = multer({
      storage,
      limits: {
        fileSize: 200 * 1024 * 1024, // 200MB limit for native files
      },
      fileFilter: (req, file, cb) => {
        const allowedExts = [".apk", ".ipa"];
        const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));

        if (allowedExts.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error("Only APK and IPA files are allowed"));
        }
      },
    });
    return upload.single("bundle");
  }
}

export default new NativeUpdateController(fileService, supabaseService);
