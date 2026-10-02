import { Hono } from "hono";
import { requireApp, type AppAccess } from "../access/app-access";
import { baseUrl, readJson } from "../http/body";
import { principal, type AppContext, type AppEnv } from "../http/context";
import { notFound } from "../lib/errors";
import { writeAudit } from "../repositories/audit";
import { deleteIntegration } from "../repositories/integrations";
import { linkRepository, requireGithubLink } from "../github/repository-link";
import {
  githubSetupStatus,
  openSetupPullRequest,
  repositoryPublicKey,
  storeEndpointVariable,
  storeSecrets,
} from "../github/setup";
import { removeGitlabTrigger, saveGitlabTrigger } from "../gitlab/runs";
import { appCi, cancelRun, rerunRun, runRefs, startRun, syncRun } from "../services/ci";
import { buildDetail } from "../services/build-detail";
import { jobLogs } from "../services/job-logs";
import { serializeBuild } from "../services/build-feed";

function audit(
  c: AppContext,
  access: AppAccess,
  action: string,
  details?: Record<string, unknown>,
) {
  const who = principal(c);
  return writeAudit(c.get("deps").db, {
    organizationId: access.app.organization_id,
    appId: access.app.id,
    actorUserId: who.userId,
    actorApiKeyId: who.credential.type === "api_key" ? who.credential.keyId : null,
    action,
    targetType: "ci",
    details,
    ip: c.get("clientIp"),
  });
}

const admin = (c: AppContext, action: string) =>
  requireApp(c.get("deps").db, principal(c), c.req.param("id") ?? "", "admin", action);

/** Connecting an app to its CI, setting the repository up, and starting runs. */
export function ciRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/apps/:id/ci", async (c) =>
    c.json(await appCi(c.get("deps"), principal(c), c.req.param("id"))),
  );

  router.put("/apps/:id/ci/github", async (c) => {
    const access = await admin(c, "Connecting GitHub");
    const body = await readJson(c, 8 * 1024);
    const link = await linkRepository(c.get("deps"), access.app, {
      installation: body.installation,
      repository_id: body.repository_id,
      workflow_path: body.workflow_path,
    });
    await audit(c, access, "ci.github.link", {
      repository: link.repository,
      workflow_path: link.workflowPath,
    });
    return c.json(await appCi(c.get("deps"), principal(c), access.app.id));
  });

  router.delete("/apps/:id/ci/github", async (c) => {
    const access = await admin(c, "Disconnecting GitHub");
    if (!(await deleteIntegration(c.get("deps").db, access.app.id, "github")))
      throw notFound("GitHub link");
    await audit(c, access, "ci.github.unlink");
    return c.body(null, 204);
  });

  router.get("/apps/:id/ci/github/setup", async (c) => {
    const access = await admin(c, "Reading the GitHub setup");
    const deps = c.get("deps");
    return c.json(
      await githubSetupStatus(deps, await requireGithubLink(deps, access.app.id), baseUrl(c)),
    );
  });

  router.post("/apps/:id/ci/github/setup/pull-request", async (c) => {
    const access = await admin(c, "Opening the setup pull request");
    const deps = c.get("deps");
    const link = await requireGithubLink(deps, access.app.id);
    const result = await openSetupPullRequest(deps, link, await readJson(c, 8 * 1024));
    await audit(c, access, "ci.github.setup_pr", {
      repository: link.repository,
      number: result.pull_request.number,
    });
    return c.json(result, result.created ? 201 : 200);
  });

  router.get("/apps/:id/ci/github/public-key", async (c) => {
    const access = await admin(c, "Encrypting repository secrets");
    const deps = c.get("deps");
    return c.json(await repositoryPublicKey(deps, await requireGithubLink(deps, access.app.id)));
  });

  router.put("/apps/:id/ci/github/secrets", async (c) => {
    const access = await admin(c, "Setting repository secrets");
    const deps = c.get("deps");
    const link = await requireGithubLink(deps, access.app.id);
    const updated = await storeSecrets(deps, link, await readJson(c, 512 * 1024));
    await audit(c, access, "ci.github.secrets", { repository: link.repository, names: updated });
    return c.json({ updated });
  });

  router.put("/apps/:id/ci/github/variables", async (c) => {
    const access = await admin(c, "Setting repository variables");
    const deps = c.get("deps");
    const link = await requireGithubLink(deps, access.app.id);
    await storeEndpointVariable(deps, link, baseUrl(c));
    await audit(c, access, "ci.github.variables", { repository: link.repository });
    return c.json({ updated: ["CAPUCHOO_ENDPOINT"] });
  });

  router.put("/apps/:id/integrations/gitlab/trigger", async (c) => {
    const access = await admin(c, "Configuring GitLab pipelines");
    const result = await saveGitlabTrigger(
      c.get("deps"),
      access.app.id,
      await readJson(c, 8 * 1024),
    );
    await audit(c, access, "ci.gitlab.trigger", {
      project: result.project,
      base_url: result.base_url,
    });
    return c.json(result);
  });

  router.delete("/apps/:id/integrations/gitlab/trigger", async (c) => {
    const access = await admin(c, "Configuring GitLab pipelines");
    if (!(await removeGitlabTrigger(c.get("deps"), access.app.id))) throw notFound("GitLab token");
    await audit(c, access, "ci.gitlab.trigger_remove");
    return c.body(null, 204);
  });

  router.get("/apps/:id/ci/refs", async (c) =>
    c.json(await runRefs(c.get("deps"), principal(c), c.req.param("id"))),
  );

  router.post("/apps/:id/ci/runs", async (c) => {
    const { access, request, build, html_url } = await startRun(
      c.get("deps"),
      principal(c),
      c.req.param("id"),
      await readJson(c, 8 * 1024),
    );
    await audit(c, access, "ci.run.start", {
      action: request.action,
      ref: request.ref,
      channel: request.channel,
      client: request.client,
      build_id: build?.id ?? null,
    });
    return c.json({ build: build ? serializeBuild(build) : null, html_url }, 201);
  });

  router.post("/builds/:id/cancel", async (c) =>
    c.json({ build: await cancelRun(c.get("deps"), principal(c), c.req.param("id")) }),
  );

  router.post("/builds/:id/rerun", async (c) => {
    const body = await readJson(c, 1024);
    return c.json({
      build: await rerunRun(
        c.get("deps"),
        principal(c),
        c.req.param("id"),
        body.failed_only === true,
      ),
    });
  });

  router.get("/builds/:id/jobs/:jobId/logs", async (c) =>
    c.json(await jobLogs(c.get("deps"), principal(c), c.req.param("id"), c.req.param("jobId"))),
  );

  router.post("/builds/:id/sync", async (c) => {
    const deps = c.get("deps");
    const who = principal(c);
    const build = await syncRun(deps, who, c.req.param("id"));
    return c.json(await buildDetail(deps, who, build.id));
  });

  return router;
}
