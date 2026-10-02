import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestContext, seedApp, type TestContext } from "./harness";
import { FakeProvider } from "./fake-provider";

describe("starting GitLab pipelines", () => {
  let ctx: TestContext;
  let gitlab: FakeProvider;

  beforeEach(async () => {
    gitlab = new FakeProvider()
      .on("GET /api/v4/projects/:project", {
        body: {
          id: 42,
          path_with_namespace: "acme/app",
          web_url: "https://gitlab.example/acme/app",
          default_branch: "main",
        },
      })
      .on("POST /api/v4/projects/:project/pipeline", {
        status: 201,
        body: {
          id: 900,
          status: "created",
          ref: "dev",
          sha: "abc",
          web_url: "https://gitlab.example/acme/app/-/pipelines/900",
          created_at: "2026-10-02T10:00:00Z",
        },
      });
    ctx = await createTestContext({ GITLAB_ALLOWED_HOSTS: "gitlab.example" }, gitlab.fetch);
  });
  afterEach(() => ctx.close());

  async function connected() {
    const owner = await ctx.user("owner@acme.test");
    const { app } = await seedApp(ctx, owner.token);
    await ctx.request(`/api/apps/${app.id}/integrations/gitlab`, {
      method: "PUT",
      token: owner.token,
      json: {},
    });
    return { owner, app };
  }

  it("stores the token sealed and triggers with the run's variables, dollars escaped", async () => {
    const { owner, app } = await connected();
    const saved = await ctx.request(`/api/apps/${app.id}/integrations/gitlab/trigger`, {
      method: "PUT",
      token: owner.token,
      json: { base_url: "https://gitlab.example", project: "acme/app", token: "glpat-secret" },
    });
    expect(saved.status).toBe(200);
    const row = await ctx.db
      .selectFrom("integrations")
      .selectAll()
      .where("kind", "=", "gitlab")
      .executeTakeFirstOrThrow();
    expect(row.credential_enc).not.toContain("glpat");

    const ci = await (await ctx.request(`/api/apps/${app.id}/ci`, { token: owner.token })).json();
    expect(ci).toMatchObject({
      provider: "gitlab",
      can_run: true,
      gitlab: { can_trigger: true, project: "acme/app" },
    });

    const started = await ctx.request(`/api/apps/${app.id}/ci/runs`, {
      method: "POST",
      token: owner.token,
      json: { ref: "dev", channel: "dev", notes: "uses $CAPUCHOO_API_KEY" },
    });
    expect(started.status).toBe(201);
    const { build } = await started.json();
    expect(build).toMatchObject({
      source: "gitlab",
      external_id: "900",
      status: "queued",
      trigger: "api",
    });
    const [trigger] = gitlab.calledWith("POST /api/v4/projects/42/pipeline");
    expect(trigger?.headers.get("private-token")).toBe("glpat-secret");
    expect(trigger?.body).toMatchObject({
      ref: "dev",
      variables: expect.arrayContaining([
        { key: "CAPUCHOO_NOTES", value: "uses $$CAPUCHOO_API_KEY", variable_type: "env_var" },
      ]),
    });
  });

  it("refuses a GitLab host that is not allowed", async () => {
    const { owner, app } = await connected();
    const response = await ctx.request(`/api/apps/${app.id}/integrations/gitlab/trigger`, {
      method: "PUT",
      token: owner.token,
      json: { base_url: "https://169.254.169.254", project: "x", token: "t" },
    });
    expect(response.status).toBe(400);
    expect(gitlab.calls).toHaveLength(0);
  });
});

describe("GitLab host validation without an allow-list", () => {
  it("refuses plain http and private addresses before calling anything", async () => {
    const fake = new FakeProvider();
    const ctx = await createTestContext({}, fake.fetch);
    try {
      const owner = await ctx.user("owner@acme.test");
      const { app } = await seedApp(ctx, owner.token);
      await ctx.request(`/api/apps/${app.id}/integrations/gitlab`, {
        method: "PUT",
        token: owner.token,
        json: {},
      });
      for (const base_url of [
        "http://gitlab.example",
        "https://10.0.0.5",
        "https://localhost",
        "https://[::1]",
      ]) {
        const response = await ctx.request(`/api/apps/${app.id}/integrations/gitlab/trigger`, {
          method: "PUT",
          token: owner.token,
          json: { base_url, project: "x", token: "t" },
        });
        expect(response.status, base_url).toBe(400);
      }
      expect(fake.calls).toHaveLength(0);
    } finally {
      await ctx.close();
    }
  });
});
