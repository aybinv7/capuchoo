import { Hono } from "hono";
import type { Principal } from "../auth/principal";
import { baseUrl, dashboardUrl, readJson } from "../http/body";
import { principal, type AppContext, type AppEnv } from "../http/context";
import { notFound } from "../lib/errors";
import { writeAudit } from "../repositories/audit";
import { githubApp } from "../github/credentials";
import {
  completeSetup,
  installUrl,
  installationRepositories,
  organizationGithub,
  serializeInstallation,
  unlinkOrganizationInstallation,
} from "../github/installations";
import { completeManifest, manifestForm, removeStoredApp } from "../github/registration";

const APP_PAGE = "/settings/github";

function audit(
  c: AppContext,
  who: Principal,
  action: string,
  organizationId: string | null,
  details?: Record<string, unknown>,
) {
  return writeAudit(c.get("deps").db, {
    organizationId,
    actorUserId: who.userId,
    actorApiKeyId: who.credential.type === "api_key" ? who.credential.keyId : null,
    action,
    targetType: "github",
    details,
    ip: c.get("clientIp"),
  });
}

function withQuery(path: string, key: string, value: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

/** The GitHub App (instance) and its installations (organizations). */
export function githubRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/github/app", async (c) => {
    const deps = c.get("deps");
    const who = principal(c);
    const app = await githubApp(deps);
    return c.json({
      configured: Boolean(app),
      source: app?.source ?? null,
      slug: app?.slug ?? null,
      name: app?.name ?? null,
      html_url: app?.htmlUrl ?? null,
      owner: app?.owner ?? null,
      webhook_url: `${baseUrl(c)}/api/integrations/github/webhook`,
      can_manage: who.isInstanceAdmin,
    });
  });

  router.post("/github/app/manifest", async (c) => {
    const body = await readJson(c, 4 * 1024);
    return c.json(
      await manifestForm(
        c.get("deps"),
        principal(c),
        { dashboard: dashboardUrl(c), api: baseUrl(c) },
        {
          organization: typeof body.organization === "string" ? body.organization : null,
          visibility: body.visibility === "public" ? "public" : "private",
          name: typeof body.name === "string" ? body.name : null,
        },
      ),
    );
  });

  router.get("/github/app/callback", async (c) => {
    const who = c.get("principal");
    if (!who) return c.redirect(withQuery(APP_PAGE, "error", "signed_out"));
    try {
      const { slug } = await completeManifest(
        c.get("deps"),
        who,
        c.req.query("code"),
        c.req.query("state"),
      );
      await audit(c, who, "github.app.create", null, { slug });
      return c.redirect(withQuery(APP_PAGE, "app", "created"));
    } catch (error) {
      c.get("logger").warn("GitHub App creation failed", { error });
      const reason =
        error && typeof error === "object" && "reason" in error ? String(error.reason) : "failed";
      return c.redirect(withQuery(APP_PAGE, "error", reason));
    }
  });

  router.delete("/github/app", async (c) => {
    const who = principal(c);
    if (!(await removeStoredApp(c.get("deps"), who))) throw notFound("GitHub App");
    await audit(c, who, "github.app.delete", null);
    return c.body(null, 204);
  });

  router.get("/github/setup", async (c) => {
    const deps = c.get("deps");
    const who = c.get("principal");
    const outcome = await completeSetup(deps, who, {
      installation_id: c.req.query("installation_id"),
      setup_action: c.req.query("setup_action"),
      state: c.req.query("state"),
      code: c.req.query("code"),
    }).catch((error: unknown) => {
      c.get("logger").warn("GitHub installation link failed", { error });
      return { returnPath: "/settings/organization", error: "failed" } as const;
    });
    if ("error" in outcome)
      return c.redirect(withQuery(outcome.returnPath, "github_error", outcome.error));
    if (who)
      await audit(c, who, "github.installation.link", null, {
        installation_id: c.req.query("installation_id"),
      });
    return c.redirect(withQuery(outcome.returnPath, "github", outcome.result));
  });

  router.get("/organizations/:orgId/github", async (c) =>
    c.json(await organizationGithub(c.get("deps"), principal(c), c.req.param("orgId"))),
  );

  router.get("/organizations/:orgId/github/install-url", async (c) =>
    c.json(
      await installUrl(c.get("deps"), principal(c), c.req.param("orgId"), c.req.query("return")),
    ),
  );

  router.delete("/organizations/:orgId/github/installations/:id", async (c) => {
    const who = principal(c);
    const orgId = c.req.param("orgId");
    const removed = await unlinkOrganizationInstallation(
      c.get("deps"),
      who,
      orgId,
      c.req.param("id"),
    );
    await audit(c, who, "github.installation.unlink", orgId, {
      installation: serializeInstallation(removed, c.get("deps").config.GITHUB_WEB_URL)
        .account_login,
    });
    return c.body(null, 204);
  });

  router.get("/organizations/:orgId/github/installations/:id/repositories", async (c) =>
    c.json(
      await installationRepositories(
        c.get("deps"),
        principal(c),
        c.req.param("orgId"),
        c.req.param("id"),
        c.req.query("q"),
      ),
    ),
  );

  return router;
}
