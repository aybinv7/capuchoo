import { randomUUID } from "node:crypto";
import { isFlavour, verifyRelease, type Environment } from "@capuchoo/core";
import { requireApp, requireDeliverRole, type AppAccess } from "../access/app-access";
import { actorColumns, type Principal } from "../auth/principal";
import type { Bundle, Channel, NativeBuild } from "../db/schema";
import type { Deps } from "../http/context";
import { ZIP_MAGIC, streamMultipart, type MeasuredStream } from "../http/multipart";
import { badRequest, conflict, forbidden, isUniqueViolation, notFound } from "../lib/errors";
import { findApp } from "../repositories/apps";
import {
  findBundleByVersion,
  findNativeByCode,
  insertBundle,
  insertNativeBuild,
  latestSigningCert,
} from "../repositories/artefacts";
import { writeAudit } from "../repositories/audit";
import { findBuild } from "../repositories/builds";
import { findChannelByName } from "../repositories/channels";
import { pointChannel } from "./delivery";

const SHA256 = /^[0-9a-f]{64}$/;
const PLATFORMS = new Set(["android", "ios", "web"]);

interface UploadContext {
  access: AppAccess;
  channel: Channel;
  flavour: Environment;
  platform: "android" | "ios" | "web";
  version: string;
  activate: boolean;
  required: boolean;
  releaseNotes: string | null;
  signature: string | null;
  buildId: string | null;
}

function truthy(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

async function prepare(
  deps: Deps,
  principal: Principal,
  fields: Record<string, string>,
): Promise<UploadContext> {
  const bundleId = fields.app_id?.trim();
  if (!bundleId) throw badRequest("app_id is required");
  const app = await findApp(deps.db, bundleId);
  if (!app) throw notFound("App");
  const access = await requireApp(deps.db, principal, app.id, "developer", "Publishing");

  const channelName = fields.channel?.trim();
  if (!channelName) throw badRequest("channel is required");
  const channel = await findChannelByName(deps.db, app.id, channelName);
  if (!channel) throw notFound(`Channel "${channelName}"`);
  if (channel.kind !== "release") {
    throw conflict(
      `"${channel.name}" is a client channel. Publish to its release channel, then deliver with channel point.`,
      "client_channel_upload",
    );
  }
  requireDeliverRole(access, channel.environment, "Publishing");

  const flavour = fields.flavour?.trim();
  if (!isFlavour(flavour))
    throw badRequest("flavour is required: dev, staging or prod", "flavour_required");

  const platform = (fields.platform ?? "android").trim();
  if (!PLATFORMS.has(platform)) throw badRequest("platform must be android, ios or web");

  const version = fields.version_name?.trim();
  if (!version || version.length > 64 || /\s/.test(version))
    throw badRequest("version_name is required");

  const signature = fields.signature?.trim() || null;
  if (app.require_signature && !signature) {
    throw forbidden(
      "This app requires signed releases. Run capuchoo keys init and deploy again.",
      "signature_required",
    );
  }

  const buildId = fields.build_id?.trim() || null;
  if (buildId) {
    const build = await findBuild(deps.db, buildId);
    if (!build || build.app_id !== app.id) throw badRequest("build_id does not belong to this app");
  }

  return {
    access,
    channel,
    flavour,
    platform: platform as UploadContext["platform"],
    version,
    activate: truthy(fields.active, true),
    required: truthy(fields.required, false),
    releaseNotes: fields.release_notes?.trim().slice(0, 10_000) || null,
    signature,
    buildId,
  };
}

async function storeVerified(
  deps: Deps,
  context: UploadContext,
  file: MeasuredStream,
  input: { key: string; contentType: string; kind: "ota" | "native"; versionCode?: number },
): Promise<{ sha256: string; bytes: number }> {
  await deps.storage.put(input.key, file.stream, input.contentType);
  const digest = file.digest();
  const { app } = context.access;
  if (app.public_key && (context.signature || app.require_signature)) {
    const valid = await verifyRelease(
      {
        kind: input.kind,
        appId: app.app_id,
        platform: context.platform,
        version: context.version,
        versionCode: input.versionCode ?? null,
        sha256: digest.sha256,
      },
      context.signature,
      app.public_key,
    );
    if (!valid) {
      await deps.storage.delete(input.key);
      throw badRequest(
        "The release signature does not match this artefact and the app's public key",
        "bad_signature",
      );
    }
  }
  return digest;
}

async function activate(
  deps: Deps,
  context: UploadContext,
  principal: Principal,
  artefact: { kind: "ota"; row: Bundle } | { kind: "native"; row: NativeBuild },
  ip: string | null,
): Promise<Channel | null> {
  if (!context.activate) return null;
  return pointChannel(deps, {
    access: context.access,
    principal,
    channel: context.channel,
    artefacts: [artefact],
    rollback: false,
    reason: "published",
    ip,
  });
}

/** Publishes an OTA bundle: streamed, hashed, signature-checked, recorded, then pointed. */
export async function uploadBundle(
  deps: Deps,
  principal: Principal,
  request: {
    body: ReadableStream<Uint8Array> | null;
    contentType: string | undefined;
    ip: string | null;
  },
) {
  const { result } = await streamMultipart({
    body: request.body,
    contentType: request.contentType,
    fileField: "bundle",
    maxBytes: deps.config.MAX_BUNDLE_BYTES,
    magic: ZIP_MAGIC,
    onFile: async (fields, file) => {
      const context = await prepare(deps, principal, fields);
      const { app } = context.access;
      if (await findBundleByVersion(deps.db, app.id, context.platform, context.version)) {
        throw conflict(
          `Version ${context.version} is already published for ${context.platform}.`,
          "version_exists",
        );
      }
      const gateText = fields.min_update_version?.trim();
      const minNative = gateText ? Number(gateText) : null;
      if (minNative !== null && (!Number.isInteger(minNative) || minNative <= 0)) {
        throw badRequest("min_update_version must be a positive native build number", "bad_gate");
      }

      const key = `apps/${app.id}/bundles/${randomUUID()}.zip`;
      const digest = await storeVerified(deps, context, file, {
        key,
        contentType: "application/zip",
        kind: "ota",
      });

      let row: Bundle;
      try {
        row = await insertBundle(deps.db, {
          app_id: app.id,
          platform: context.platform,
          version_name: context.version,
          flavour: context.flavour,
          storage_key: key,
          size_bytes: digest.bytes,
          checksum: digest.sha256,
          signature: context.signature,
          min_native_version: minNative,
          required: context.required,
          release_notes: context.releaseNotes,
          uploaded_by: principal.userId,
          api_key_id: actorColumns(principal).actor_api_key_id,
          build_id: context.buildId,
        });
      } catch (error) {
        await deps.storage.delete(key);
        if (isUniqueViolation(error))
          throw conflict(`Version ${context.version} is already published.`, "version_exists");
        throw error;
      }

      let channel: Channel | null;
      try {
        channel = await activate(deps, context, principal, { kind: "ota", row }, request.ip);
      } catch (error) {
        await deps.db.deleteFrom("bundles").where("id", "=", row.id).execute();
        await deps.storage.delete(key);
        throw error;
      }

      await writeAudit(deps.db, {
        organizationId: app.organization_id,
        appId: app.id,
        actorUserId: principal.userId,
        actorApiKeyId: actorColumns(principal).actor_api_key_id,
        action: "bundle.upload",
        targetType: "bundle",
        targetId: row.id,
        details: { version: row.version_name, channel: context.channel.name, bytes: digest.bytes },
        ip: request.ip,
      });
      deps.hub.publish({
        type: "artefact",
        appId: app.id,
        data: { kind: "ota", id: row.id, version: row.version_name },
      });
      return { bundle: row, channel };
    },
  });
  return result;
}

/** Publishes a native build, refusing a signing-certificate change unless an admin allows it. */
export async function uploadNative(
  deps: Deps,
  principal: Principal,
  request: {
    body: ReadableStream<Uint8Array> | null;
    contentType: string | undefined;
    ip: string | null;
  },
) {
  const { result } = await streamMultipart({
    body: request.body,
    contentType: request.contentType,
    fileField: "bundle",
    maxBytes: deps.config.MAX_NATIVE_BYTES,
    magic: ZIP_MAGIC,
    onFile: async (fields, file, filename) => {
      const context = await prepare(deps, principal, fields);
      const { app } = context.access;
      if (context.platform === "web") throw badRequest("A native build is android or ios");
      const versionCode = Number(fields.version_code);
      if (!Number.isInteger(versionCode) || versionCode <= 0)
        throw badRequest("version_code must be a positive integer");
      if (await findNativeByCode(deps.db, app.id, context.platform, context.flavour, versionCode)) {
        throw conflict(
          `Build ${versionCode} is already published for ${context.flavour}.`,
          "version_exists",
        );
      }

      const cert = fields.signing_cert_sha256?.trim().toLowerCase().replace(/:/g, "") || null;
      if (cert && !SHA256.test(cert))
        throw badRequest("signing_cert_sha256 must be a SHA-256 hex digest");
      const previous = await latestSigningCert(deps.db, app.id, context.platform, context.flavour);
      if (cert && previous?.signing_cert_sha256 && previous.signing_cert_sha256 !== cert) {
        const allowed = truthy(fields.allow_cert_change, false) && context.access.role === "admin";
        if (!allowed) {
          throw conflict(
            `This build is signed with a different certificate than build ${previous.version_code}. Android will refuse to install it over existing installs.`,
            "certificate_changed",
          );
        }
      }

      const extension = /\.(aab|ipa)$/i.exec(filename)?.[1]?.toLowerCase() ?? "apk";
      const key = `apps/${app.id}/native/${randomUUID()}.${extension}`;
      const digest = await storeVerified(deps, context, file, {
        key,
        contentType: "application/vnd.android.package-archive",
        kind: "native",
        versionCode,
      });

      let row: NativeBuild;
      try {
        row = await insertNativeBuild(deps.db, {
          app_id: app.id,
          platform: context.platform,
          version_name: context.version,
          version_code: versionCode,
          flavour: context.flavour,
          storage_key: key,
          size_bytes: digest.bytes,
          checksum: digest.sha256,
          signature: context.signature,
          signing_cert_sha256: cert,
          required: context.required,
          release_notes: context.releaseNotes,
          min_sdk: fields.min_sdk ? Number(fields.min_sdk) || null : null,
          uploaded_by: principal.userId,
          api_key_id: actorColumns(principal).actor_api_key_id,
          build_id: context.buildId,
        });
      } catch (error) {
        await deps.storage.delete(key);
        if (isUniqueViolation(error))
          throw conflict(`Build ${versionCode} is already published.`, "version_exists");
        throw error;
      }

      let channel: Channel | null;
      try {
        channel = await activate(deps, context, principal, { kind: "native", row }, request.ip);
      } catch (error) {
        await deps.db.deleteFrom("native_builds").where("id", "=", row.id).execute();
        await deps.storage.delete(key);
        throw error;
      }

      await writeAudit(deps.db, {
        organizationId: app.organization_id,
        appId: app.id,
        actorUserId: principal.userId,
        actorApiKeyId: actorColumns(principal).actor_api_key_id,
        action: "native.upload",
        targetType: "native_build",
        targetId: row.id,
        details: {
          version: row.version_name,
          code: versionCode,
          channel: context.channel.name,
          bytes: digest.bytes,
        },
        ip: request.ip,
      });
      deps.hub.publish({
        type: "artefact",
        appId: app.id,
        data: { kind: "native", id: row.id, version: row.version_name },
      });
      return { native: row, channel };
    },
  });
  return result;
}
