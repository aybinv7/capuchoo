import { Readable } from "node:stream";
import { Hono } from "hono";
import { requireApp } from "../access/app-access";
import { meteredBody } from "../http/binary-body";
import { principal, type AppEnv } from "../http/context";
import { badRequest, notFound } from "../lib/errors";
import { findSourceMap, listSourceMaps } from "../repositories/source-maps";
import { SOURCE_MAP_LIMITS, parseMapTarget, storeSourceMap } from "../services/source-maps";

const JSON_MAGIC = Buffer.from("{");

/**
 * Source maps per app version. The CLI uploads the `.map` files a build produced, which never ship
 * to devices; the dashboard reads them to show a recorded stack in the app's own sources.
 */
export function sourceMapRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.put("/apps/:id/source-maps", async (c) => {
    const deps = c.get("deps");
    const target = parseMapTarget(c.req.query("version"), c.req.query("path"));
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "developer",
      "Uploading source maps",
    );
    const body = meteredBody(c, SOURCE_MAP_LIMITS.bytes, JSON_MAGIC, () =>
      badRequest("A source map must be JSON", "not_json"),
    );
    const stored = await storeSourceMap(deps, access.app.id, target, body);
    return c.json(
      { path: target.path, version: target.versionName, size_bytes: stored.sizeBytes },
      stored.replaced ? 200 : 201,
    );
  });

  router.get("/apps/:id/source-maps", async (c) => {
    const deps = c.get("deps");
    const version = c.req.query("version")?.trim();
    if (!version) throw badRequest("version is required", "bad_version");
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Reading source maps",
    );
    const maps = await listSourceMaps(deps.db, access.app.id, version);
    return c.json({
      version,
      maps: maps.map((map) => ({
        path: map.path,
        size_bytes: Number(map.size_bytes),
        uploaded_at: map.created_at.toISOString(),
      })),
    });
  });

  router.get("/apps/:id/source-maps/file", async (c) => {
    const deps = c.get("deps");
    const target = parseMapTarget(c.req.query("version"), c.req.query("path"));
    const access = await requireApp(
      deps.db,
      principal(c),
      c.req.param("id"),
      "viewer",
      "Reading source maps",
    );
    const map = await findSourceMap(deps.db, access.app.id, target.versionName, target.path);
    if (!map) throw notFound("Source map");
    const object = await deps.storage.get(map.storage_key);
    return c.body(Readable.toWeb(object.body) as ReadableStream, 200, {
      "content-type": "application/json",
      "content-length": String(object.size),
      "cache-control": "private, max-age=3600",
    });
  });

  return router;
}
