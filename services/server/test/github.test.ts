import { renderGithubWorkflow } from "@capuchoo/core";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { parseGithubWorkflowPlan } from "../src/github/workflow-plan";
import { SecretBox } from "../src/lib/secret-box";
import { SignedState } from "../src/lib/signed-state";
import { linkInstallation } from "../src/repositories/github-installations";
import { createTestContext, seedApp, type TestContext } from "./harness";
import { FakeProvider, githubAppEnv, githubDelivery } from "./fake-provider";

const REPO = "acme/app";
const REPO_ID = 9001;
const INSTALLATION = "777";

function fakeGithub(): FakeProvider {
  return new FakeProvider()
    .on("POST /app/installations/:id/access_tokens", {
      status: 201,
      body: {
        token: "ghs_installation",
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      },
    })
    .on(`GET /repositories/${REPO_ID}`, {
      body: {
        id: REPO_ID,
        full_name: REPO,
        private: true,
        default_branch: "main",
        html_url: `https://github.com/${REPO}`,
      },
    })
    .on(`GET /repos/${REPO}/contents/.github/workflows/capuchoo.yml`, {
      body: renderGithubWorkflow({ cliVersion: "1.0.0", clients: ["acme"] }),
    });
}

async function linkedApp(ctx: TestContext) {
  const owner = await ctx.user("owner@acme.test");
  const seeded = await seedApp(ctx, owner.token);
  const installation = await linkInstallation(ctx.db, {
    organizationId: seeded.org.id,
    installationId: INSTALLATION,
    accountLogin: "acme",
    accountType: "Organization",
    repositorySelection: "selected",
    suspendedAt: null,
    createdBy: owner.id,
  });
  const linked = await ctx.request(`/api/apps/${seeded.app.id}/ci/github`, {
    method: "PUT",
    token: owner.token,
    json: { installation: installation.id, repository_id: REPO_ID },
  });
  expect(linked.status).toBe(200);
  return { owner, ...seeded, installation };
}

const runPayload = (overrides: Record<string, unknown> = {}) => ({
  action: "requested",
  installation: { id: Number(INSTALLATION) },
  repository: { id: REPO_ID, full_name: REPO },
  workflow_run: {
    id: 555,
    run_attempt: 1,
    status: "queued",
    conclusion: null,
    head_sha: "abc123",
    head_branch: "staging",
    event: "push",
    display_title: "Fix login",
    name: "Capuchoo",
    html_url: `https://github.com/${REPO}/actions/runs/555`,
    path: ".github/workflows/capuchoo.yml",
    run_started_at: "2026-10-02T10:00:00Z",
    updated_at: "2026-10-02T10:00:00Z",
    ...overrides,
  },
});

const jobPayload = (overrides: Record<string, unknown> = {}) => ({
  action: "in_progress",
  installation: { id: Number(INSTALLATION) },
  repository: { id: REPO_ID, full_name: REPO },
  workflow_job: {
    id: 1001,
    run_id: 555,
    run_attempt: 1,
    name: "publish-ota",
    status: "in_progress",
    conclusion: null,
    started_at: "2026-10-02T10:01:00Z",
    completed_at: null,
    html_url: `https://github.com/${REPO}/actions/runs/555/job/1001`,
    runner_name: "GitHub Actions 2",
    workflow_name: "Capuchoo",
    head_sha: "abc123",
    head_branch: "staging",
    steps: [{ name: "Set up job", status: "completed", conclusion: "success", number: 1 }],
    ...overrides,
  },
});

describe("secret box and signed state", () => {
  it("binds a sealed secret to its key and purpose", () => {
    const box = new SecretBox("a".repeat(40));
    const sealed = box.seal("pem body", "github_app.private_key");
    expect(box.open(sealed, "github_app.private_key")).toBe("pem body");
    expect(() => box.open(sealed, "github_app.client_secret")).toThrow();
    expect(() => new SecretBox("b".repeat(40)).open(sealed, "github_app.private_key")).toThrow();
    expect(() => box.open(`${sealed.slice(0, -2)}xx`, "github_app.private_key")).toThrow();
  });

  it("refuses a tampered, expired or misdirected state", () => {
    const states = new SignedState("a".repeat(40));
    const now = new Date("2026-10-02T10:00:00Z");
    const state = states.sign("github-install", { u: "user" }, new Date(now.getTime() + 60_000));
    expect(states.verify("github-install", state, now)).toMatchObject({ u: "user" });
    expect(states.verify("github-manifest", state, now)).toBeNull();
    expect(states.verify("github-install", state, new Date(now.getTime() + 120_000))).toBeNull();
    expect(states.verify("github-install", `x${state}`, now)).toBeNull();
  });
});

describe("workflow plan", () => {
  it("reads the job graph of the generated workflow", () => {
    const plan = parseGithubWorkflowPlan(
      renderGithubWorkflow({ cliVersion: "1.0.0", clients: ["acme"] }),
      ".github/workflows/capuchoo.yml",
    );
    expect(plan?.jobs.map((job) => [job.key, job.needs, job.gated])).toEqual([
      ["plan", [], false],
      ["check", ["plan"], false],
      ["publish-ota", ["plan", "check"], true],
      ["publish-native", ["plan", "check"], true],
      ["deliver", ["plan"], true],
    ]);
  });

  it("returns null for something that is not a workflow", () => {
    expect(parseGithubWorkflowPlan("not: [valid", "x.yml")).toBeNull();
    expect(parseGithubWorkflowPlan("name: x", "x.yml")).toBeNull();
  });
});

describe("GitHub webhook", () => {
  let ctx: TestContext;
  let github: FakeProvider;

  beforeEach(async () => {
    github = fakeGithub();
    ctx = await createTestContext(githubAppEnv(), github.fetch);
  });
  afterEach(() => ctx.close());

  it("refuses a delivery with a wrong signature", async () => {
    await linkedApp(ctx);
    const response = await ctx.request(
      "/api/integrations/github/webhook",
      githubDelivery("workflow_run", runPayload(), "wrong-secret-000000"),
    );
    expect(response.status).toBe(401);
  });

  it("records a run, its plan and its jobs, never moving a job backwards", async () => {
    const { owner, app } = await linkedApp(ctx);
    const seen: string[] = [];
    ctx.deps.hub.subscribe(app.id, (event) => seen.push(event.type));

    await ctx.request(
      "/api/integrations/github/webhook",
      githubDelivery("workflow_run", runPayload()),
    );
    await ctx.request(
      "/api/integrations/github/webhook",
      githubDelivery(
        "workflow_job",
        jobPayload({
          status: "completed",
          conclusion: "success",
          completed_at: "2026-10-02T10:03:00Z",
        }),
      ),
    );
    await ctx.request(
      "/api/integrations/github/webhook",
      githubDelivery("workflow_job", jobPayload()),
    );
    await ctx.request(
      "/api/integrations/github/webhook",
      githubDelivery(
        "workflow_run",
        runPayload({
          status: "completed",
          conclusion: "success",
          updated_at: "2026-10-02T10:04:00Z",
        }),
      ),
    );

    const builds = await (
      await ctx.request(`/api/apps/${app.id}/builds?scope=top`, { token: owner.token })
    ).json();
    expect(builds).toHaveLength(1);
    expect(builds[0]).toMatchObject({
      source: "github",
      external_id: "555",
      status: "succeeded",
      ref: "staging",
      title: "Fix login",
      trigger: "push",
    });
    expect(builds[0].plan).toBeUndefined();

    const detail = await (
      await ctx.request(`/api/builds/${builds[0].id}`, { token: owner.token })
    ).json();
    expect(detail.plan.jobs.map((job: { key: string }) => job.key)).toContain("publish-ota");
    expect(detail.jobs).toHaveLength(1);
    expect(detail.jobs[0]).toMatchObject({
      plan_key: "publish-ota",
      status: "succeeded",
      runner: "GitHub Actions 2",
    });
    expect(seen).toContain("build_job");
  });

  it("ignores runs of other workflows in the repository", async () => {
    const { owner, app } = await linkedApp(ctx);
    const response = await ctx.request(
      "/api/integrations/github/webhook",
      githubDelivery("workflow_run", runPayload({ path: ".github/workflows/lint.yml" })),
    );
    expect(await response.json()).toEqual({ handled: false });
    const builds = await (
      await ctx.request(`/api/apps/${app.id}/builds`, { token: owner.token })
    ).json();
    expect(builds).toHaveLength(0);
  });

  it("adopts a run when its job arrives first, only if it is the linked workflow", async () => {
    const { owner, app } = await linkedApp(ctx);
    github.on(`GET /repos/${REPO}/actions/runs/555`, {
      body: runPayload({ status: "in_progress" }).workflow_run,
    });
    await ctx.request(
      "/api/integrations/github/webhook",
      githubDelivery("workflow_job", jobPayload()),
    );
    github.on(`GET /repos/${REPO}/actions/runs/556`, {
      body: runPayload({ id: 556, path: ".github/workflows/lint.yml" }).workflow_run,
    });
    await ctx.request(
      "/api/integrations/github/webhook",
      githubDelivery("workflow_job", jobPayload({ id: 1002, run_id: 556 })),
    );
    const builds = await (
      await ctx.request(`/api/apps/${app.id}/builds`, { token: owner.token })
    ).json();
    expect(
      builds.map((build: { external_id: string; status: string }) => [
        build.external_id,
        build.status,
      ]),
    ).toEqual([["555", "running"]]);
  });

  it("follows a renamed repository", async () => {
    const { owner, app } = await linkedApp(ctx);
    const renamed = runPayload();
    renamed.repository.full_name = "acme/renamed";
    await ctx.request("/api/integrations/github/webhook", githubDelivery("workflow_run", renamed));
    const ci = await (await ctx.request(`/api/apps/${app.id}/ci`, { token: owner.token })).json();
    expect(ci.github.repository).toMatchObject({
      full_name: "acme/renamed",
      html_url: "https://github.com/acme/renamed",
    });
  });

  it("drops the links of an uninstalled installation", async () => {
    const { owner, app } = await linkedApp(ctx);
    await ctx.request(
      "/api/integrations/github/webhook",
      githubDelivery("installation", {
        action: "deleted",
        installation: { id: Number(INSTALLATION) },
      }),
    );
    const ci = await (await ctx.request(`/api/apps/${app.id}/ci`, { token: owner.token })).json();
    expect(ci.github).toBeNull();
    expect(ci.can_run).toBe(false);
  });
});

describe("starting runs from Capuchoo", () => {
  let ctx: TestContext;
  let github: FakeProvider;

  beforeEach(async () => {
    github = fakeGithub().on(`POST /repos/${REPO}/actions/workflows/capuchoo.yml/dispatches`, {
      body: { workflow_run_id: 9999, html_url: `https://github.com/${REPO}/actions/runs/9999` },
    });
    ctx = await createTestContext(githubAppEnv(), github.fetch);
  });
  afterEach(() => ctx.close());

  it("dispatches the workflow with validated inputs and records the run at once", async () => {
    const { owner, app } = await linkedApp(ctx);
    const response = await ctx.request(`/api/apps/${app.id}/ci/runs`, {
      method: "POST",
      token: owner.token,
      json: {
        action: "native",
        ref: "staging",
        channel: "staging",
        version: "auto",
        build_type: "debug",
      },
    });
    expect(response.status).toBe(201);
    const { build, html_url } = await response.json();
    expect(build).toMatchObject({
      status: "queued",
      external_id: "9999",
      title: "Build native to staging @ auto",
      actor_user_id: owner.id,
    });
    expect(html_url).toContain("/actions/runs/9999");
    const [dispatch] = github.calledWith(
      `POST /repos/${REPO}/actions/workflows/capuchoo.yml/dispatches`,
    );
    expect(dispatch?.body).toEqual({
      ref: "staging",
      inputs: { action: "native", channel: "staging", version: "auto", build_type: "debug" },
      return_run_details: true,
    });
    expect(dispatch?.headers.get("authorization")).toBe("Bearer ghs_installation");

    await ctx.request(
      "/api/integrations/github/webhook",
      githubDelivery("workflow_run", runPayload({ id: 9999, display_title: "Capuchoo" })),
    );
    const detail = await (
      await ctx.request(`/api/builds/${build.id}`, { token: owner.token })
    ).json();
    expect(detail.title).toBe("Build native to staging @ auto");
  });

  it("refuses an injected ref and needs prod rights for a run with no channel", async () => {
    const { owner, app } = await linkedApp(ctx);
    const developer = await ctx.user("dev@acme.test");
    await ctx.request(`/api/apps/${app.id}/permissions`, {
      method: "POST",
      token: owner.token,
      json: { email: developer.email, role: "developer" },
    });
    const bad = await ctx.request(`/api/apps/${app.id}/ci/runs`, {
      method: "POST",
      token: owner.token,
      json: { ref: "main; curl evil" },
    });
    expect(bad.status).toBe(400);
    const unknown = await ctx.request(`/api/apps/${app.id}/ci/runs`, {
      method: "POST",
      token: developer.token,
      json: { ref: "dev", channel: "nope" },
    });
    expect(unknown.status).toBe(400);
    const ok = await ctx.request(`/api/apps/${app.id}/ci/runs`, {
      method: "POST",
      token: developer.token,
      json: { ref: "dev", channel: "dev" },
    });
    expect(ok.status).toBe(201);
  });

  it("attaches a CLI deploy to the run it ran in", async () => {
    const { owner, app } = await linkedApp(ctx);
    const child = await (
      await ctx.request(`/api/apps/${app.id}/builds`, {
        method: "POST",
        token: owner.token,
        json: {
          kind: "ota",
          channel: "staging",
          version: "1.0.1-staging.1",
          source: "github",
          commit: "abc123",
          ci: { provider: "github", run_id: "555", run_attempt: 1, job: "publish-ota" },
        },
      })
    ).json();
    await ctx.request(`/api/builds/${child.id}/events`, {
      method: "POST",
      token: owner.token,
      json: { step: "web", status: "running" },
    });
    expect(child.parent_id).toBeTruthy();
    const top = await (
      await ctx.request(`/api/apps/${app.id}/builds?scope=top`, { token: owner.token })
    ).json();
    expect(
      top.map((build: { id: string; child_count: number }) => [build.id, build.child_count]),
    ).toEqual([[child.parent_id, 1]]);
    const parent = await (
      await ctx.request(`/api/builds/${child.parent_id}`, { token: owner.token })
    ).json();
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0]).toMatchObject({ job_key: "publish-ota", events: [{ step: "web" }] });
  });

  it("throttles manual syncs per run", async () => {
    const { owner, app } = await linkedApp(ctx);
    github
      .on(`GET /repos/${REPO}/actions/runs/9999`, {
        body: runPayload({ id: 9999, status: "in_progress" }).workflow_run,
      })
      .on(`GET /repos/${REPO}/actions/runs/9999/jobs`, {
        body: { jobs: [jobPayload({ run_id: 9999 }).workflow_job] },
      });
    const { build } = await (
      await ctx.request(`/api/apps/${app.id}/ci/runs`, {
        method: "POST",
        token: owner.token,
        json: { ref: "dev", channel: "dev" },
      })
    ).json();
    const first = await ctx.request(`/api/builds/${build.id}/sync`, {
      method: "POST",
      token: owner.token,
    });
    expect(first.status).toBe(200);
    expect((await first.json()).jobs).toHaveLength(1);
    const second = await ctx.request(`/api/builds/${build.id}/sync`, {
      method: "POST",
      token: owner.token,
    });
    expect(second.status).toBe(429);
  });
});

describe("GitHub installation linking", () => {
  let ctx: TestContext;
  let github: FakeProvider;

  beforeEach(async () => {
    github = fakeGithub()
      .on("POST /login/oauth/access_token", { body: { access_token: "ghu_user" } })
      .on("DELETE /applications/:id/token", { status: 204 })
      .on("GET /app/installations/:id", {
        body: {
          id: 777,
          account: { login: "acme", type: "Organization" },
          repository_selection: "all",
        },
      });
    ctx = await createTestContext(githubAppEnv(), github.fetch);
  });
  afterEach(() => ctx.close());

  async function setup(installations: number[]) {
    github.on("GET /user/installations", {
      body: { installations: installations.map((id) => ({ id })) },
    });
    const owner = await ctx.user("owner@acme.test");
    const { org } = await seedApp(ctx, owner.token);
    const { url } = await (
      await ctx.request(
        `/api/organizations/${org.id}/github/install-url?return=/apps/x/settings/ci`,
        { token: owner.token },
      )
    ).json();
    const state = new URL(url).searchParams.get("state")!;
    const response = await ctx.request(
      `/api/github/setup?installation_id=777&setup_action=install&code=abc&state=${encodeURIComponent(state)}`,
      { token: owner.token, redirect: "manual" },
    );
    return { owner, org, location: response.headers.get("location") ?? "" };
  }

  it("links an installation the user can see and revokes their token", async () => {
    const { owner, org, location } = await setup([777]);
    expect(location).toBe("/apps/x/settings/ci?github=linked");
    const linked = await (
      await ctx.request(`/api/organizations/${org.id}/github`, { token: owner.token })
    ).json();
    expect(linked.installations).toEqual([
      expect.objectContaining({ installation_id: "777", account_login: "acme" }),
    ]);
    expect(github.calledWith("DELETE /applications/Iv1.test/token")).toHaveLength(1);
  });

  it("refuses an installation id the user cannot see", async () => {
    const { owner, org, location } = await setup([1]);
    expect(location).toBe("/apps/x/settings/ci?github_error=not_yours");
    const linked = await (
      await ctx.request(`/api/organizations/${org.id}/github`, { token: owner.token })
    ).json();
    expect(linked.installations).toEqual([]);
  });
});

describe("GitHub App creation", () => {
  it("lets only an instance admin start it and stores the credentials sealed", async () => {
    const github = new FakeProvider().on("POST /app-manifests/:code/conversions", {
      status: 201,
      body: {
        id: 1234,
        slug: "capuchoo-acme",
        name: "Capuchoo acme",
        html_url: "https://github.com/apps/capuchoo-acme",
        client_id: "Iv1.abc",
        client_secret: "shh",
        webhook_secret: "hook-secret-0123456789",
        pem: githubAppEnv().GITHUB_APP_PRIVATE_KEY,
        owner: { login: "acme" },
      },
    });
    const ctx = await createTestContext({ DASHBOARD_URL: "https://dash.example" }, github.fetch);
    try {
      const member = await ctx.user("member@acme.test");
      const admin = await ctx.user("admin@acme.test", { admin: true });
      expect(
        (
          await ctx.request("/api/github/app/manifest", {
            method: "POST",
            token: member.token,
            json: {},
          })
        ).status,
      ).toBe(403);
      const form = await (
        await ctx.request("/api/github/app/manifest", {
          method: "POST",
          token: admin.token,
          json: {},
        })
      ).json();
      expect(JSON.parse(form.manifest)).toMatchObject({
        request_oauth_on_install: true,
        public: false,
        redirect_url: "https://dash.example/api/github/app/callback",
        setup_url: "https://dash.example/api/github/setup",
        hook_attributes: { url: "http://capuchoo.test/api/integrations/github/webhook" },
      });
      const state = new URL(form.action).searchParams.get("state")!;
      const callback = await ctx.request(
        `/api/github/app/callback?code=xyz&state=${encodeURIComponent(state)}`,
        {
          token: admin.token,
          redirect: "manual",
        },
      );
      expect(callback.headers.get("location")).toBe("/settings/github?app=created");
      const row = await ctx.db.selectFrom("github_app").selectAll().executeTakeFirstOrThrow();
      expect(row.webhook_secret_enc).not.toContain("hook-secret");
      const status = await (await ctx.request("/api/github/app", { token: member.token })).json();
      expect(status).toMatchObject({
        configured: true,
        source: "database",
        slug: "capuchoo-acme",
        can_manage: false,
      });
    } finally {
      await ctx.close();
    }
  });
});
