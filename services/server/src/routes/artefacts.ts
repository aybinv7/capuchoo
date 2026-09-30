import { Readable } from "node:stream";
import { Hono } from "hono";
import { requireApp } from "../access/app-access";
import { baseUrl, readJson } from "../http/body";
import { principal, type AppContext, type AppEnv } from "../http/context";
import { serializeBundle, serializeNative } from "../http/serializers";
import { HttpError, conflict, notFound } from "../lib/errors";
import {
  findBundle,
  findNativeBuild,
  softDeleteBundle,
  softDeleteNativeBuild,
  updateBundleMeta,
  updateNativeMeta,
} from "../repositories/artefacts";
import { writeAudit } from "../repositories/audit";
import { channelsServing } from "../repositories/channels";
import { artefactUrl } from "../services/artefact-links";
import { uploadBundle, uploadNative } from "../services/uploads";
import { verifyArtefactSignature } from "../storage/signed-url";
import { requireDeliverRole } from "../access/app-access";

function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return "invalid";
  const [, from, to] = match;
  if (!from && !to) return "invalid";
  let start: number;
  let end: number;
  if (!from) {
    start = Math.max(0, size - Number(to));
    end = size - 1;
  } else {
    start = Number(from);
    end = to ? Math.min(Number(to), size - 1) : size - 1;
  }
  if (start > end || start >= size) return "invalid";
  return { start, end };
}

async function loadArtefact(c: AppContext, kind: "bundles" | "natives", id: string) {
  const { db } = c.get("deps");
  const row = kind === "bundles" ? await findBundle(db, id) : await findNativeBuild(db, id);
  if (!row) throw notFound(kind === "bundles" ? "Bundle" : "Native build");
  return row;
}

/** Downloads, uploads, and the lifecycle of a stored artefact. */
export function artefactRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/artefacts/*", async (c) => {
    const deps = c.get("deps");
    const key = decodeURIComponent(new URL(c.req.url).pathname.replace(/^.*?\/artefacts\//, ""));
    const check = verifyArtefactSignature(
      deps.config.SECRET_KEY,
      key,
      c.req.query("exp"),
      c.req.query("sig"),
      deps.now().getTime(),
    );
    if (check === "expired")
      throw new HttpError(
        410,
        "This download link has expired; check for updates again",
        "link_expired",
      );
    if (check !== "ok") throw new HttpError(403, "Invalid download link", "bad_link");

    const meta = await deps.storage.stat(key);
    if (!meta) throw notFound("Artefact");
    const range = parseRange(c.req.header("range"), meta.size);
    if (range === "invalid") {
      return c.body(null, 416, { "content-range": `bytes */${meta.size}` });
    }
    const object = await deps.storage.get(key, range ?? undefined);
    const headers: Record<string, string> = {
      "content-type": meta.contentType,
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=3600, immutable",
      "content-length": String(range ? range.end - range.start + 1 : meta.size),
    };
    if (range) headers["content-range"] = `bytes ${range.start}-${range.end}/${meta.size}`;
    return c.body(Readable.toWeb(object.body) as ReadableStream, range ? 206 : 200, headers);
  });

  router.post("/admin/upload", async (c) => {
    const result = await uploadBundle(c.get("deps"), principal(c), {
      body: c.req.raw.body,
      contentType: c.req.header("content-type"),
      ip: c.get("clientIp"),
    });
    return c.json(
      {
        status: "success",
        bundle: serializeBundle(result.bundle),
        channel: result.channel?.name ?? null,
      },
      201,
    );
  });

  router.post("/admin/native-upload", async (c) => {
    const result = await uploadNative(c.get("deps"), principal(c), {
      body: c.req.raw.body,
      contentType: c.req.header("content-type"),
      ip: c.get("clientIp"),
    });
    return c.json(
      {
        status: "success",
        native: serializeNative(result.native),
        channel: result.channel?.name ?? null,
      },
      201,
    );
  });

  for (const kind of ["bundles", "natives"] as const) {
    router.get(`/${kind}/:id/download`, async (c) => {
      const row = await loadArtefact(c, kind, c.req.param("id"));
      await requireApp(c.get("deps").db, principal(c), row.app_id, "viewer", "Downloading");
      return c.json({
        url: await artefactUrl(c.get("deps"), baseUrl(c), row.storage_key),
        expires_in: c.get("deps").config.ARTEFACT_URL_TTL,
      });
    });

    router.patch(`/${kind}/:id`, async (c) => {
      const deps = c.get("deps");
      const row = await loadArtefact(c, kind, c.req.param("id"));
      const access = await requireApp(
        deps.db,
        principal(c),
        row.app_id,
        "developer",
        "Editing a release",
      );
      requireDeliverRole(access, row.flavour, "Editing a release");
      const body = await readJson(c, 16 * 1024);
      const patch: { required?: boolean; release_notes?: string | null } = {};
      if (typeof body.required === "boolean") patch.required = body.required;
      if (body.release_notes !== undefined)
        patch.release_notes =
          typeof body.release_notes === "string" ? body.release_notes.slice(0, 10_000) : null;
      const updated =
        kind === "bundles"
          ? await updateBundleMeta(deps.db, row.id, patch)
          : await updateNativeMeta(deps.db, row.id, patch);
      deps.cache.invalidate(`app:${row.app_id}`);
      return c.json(
        kind === "bundles" ? serializeBundle(updated as never) : serializeNative(updated as never),
      );
    });

    router.delete(`/${kind}/:id`, async (c) => {
      const deps = c.get("deps");
      const who = principal(c);
      const row = await loadArtefact(c, kind, c.req.param("id"));
      const access = await requireApp(deps.db, who, row.app_id, "admin", "Deleting a release");
      const serving = await channelsServing(deps.db, row.id);
      if (serving.length > 0) {
        throw conflict(
          `Still served by ${serving.map((channel) => channel.name).join(", ")}. Point those channels elsewhere first.`,
          "still_served",
        );
      }
      if (kind === "bundles") await softDeleteBundle(deps.db, row.id, deps.now());
      else await softDeleteNativeBuild(deps.db, row.id, deps.now());
      deps.tasks.run("artefact delete", () => deps.storage.delete(row.storage_key));
      await writeAudit(deps.db, {
        organizationId: access.app.organization_id,
        appId: access.app.id,
        actorUserId: who.userId,
        actorApiKeyId: who.credential.type === "api_key" ? who.credential.keyId : null,
        action: `${kind === "bundles" ? "bundle" : "native"}.delete`,
        targetType: kind,
        targetId: row.id,
        details: { version: row.version_name },
        ip: c.get("clientIp"),
      });
      deps.cache.invalidate(`app:${row.app_id}`);
      return c.body(null, 204);
    });
  }

  return router;
}
