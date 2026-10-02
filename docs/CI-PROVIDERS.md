# CI providers

How Capuchoo connects to GitHub Actions and GitLab CI: it records every run, draws its job graph,
starts runs from the dashboard, and sets a repository up without leaving the dashboard.

The shared vocabulary is in `packages/core/src/pipeline.ts` (statuses, plans, layout),
`packages/core/src/ci-run.ts` (what a started run asks for) and
`packages/core/src/github-workflow.ts` (the workflow file). Nothing provider-specific goes past
the server's edge.

## Shape

```
GitHub ── webhook (workflow_run, workflow_job) ──▶ /api/integrations/github/webhook
GitLab ── webhook (pipeline, job) ───────────────▶ /api/integrations/gitlab/:appId
CLI in a job ── POST /api/apps/:id/builds {ci} ──▶ child build under the run
                                                     │
                     builds (one per run) ◀──────────┤
                     build_jobs (one per job)        │ SSE: build, build_job, build_event
                     build_events (CLI deploy steps) ▼
                                                 dashboard
Dashboard ── POST /api/apps/:id/ci/runs ──▶ workflow_dispatch / GitLab pipeline API
```

- **A run is a `builds` row** with `kind = 'pipeline'`, `source` = the provider and
  `external_id` = the provider's run id. Its jobs are `build_jobs`. Its **plan** - the job graph
  read from the workflow file - is `builds.plan`, so jobs that have not started yet are still
  drawn.
- **The CLI's own deploy is a child build** (`parent_id` = the run, `job_key` = the job it ran in).
  Its `build_events` are the deploy steps (resolve, web, bundle, sign, upload), so the publish job
  on the canvas opens onto them.
- **Status never moves backwards** (`mergeJobStatus`, `mergeBuildStatus`): webhooks arrive out of
  order and twice. A higher `run_attempt` restarts the run.

## GitHub

### Why a GitHub App

A GitHub App is created once per Capuchoo instance through the
[manifest flow](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest):
one click in the dashboard, and GitHub returns the app id, private key and webhook secret. The
server mints **installation tokens** (one hour, per installation) on demand and never stores them.
What is stored is the installation id per organization and the repository per app - no personal
token, nothing long-lived per user.

The private key, client secret and webhook secret are stored encrypted (AES-256-GCM, key derived
from `SECRET_KEY` with HKDF). **Rotating `SECRET_KEY` makes them unreadable**: re-create the App.
Setting `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`,
`GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in the environment overrides the stored App.

Permissions requested: Actions read/write, Contents read/write, Pull requests read/write,
Secrets read/write, Variables read/write, Workflows read/write, Metadata read. Events:
`workflow_run`, `workflow_job`.

**Linking an installation to an organization is verified**, not trusted. GitHub's install redirect
carries an `installation_id` anyone could forge, so the App requests user authorization on install
and the server checks, with that user's token, that the user can see the installation. The token
is discarded afterwards.

The dashboard's CSP must allow `form-action https://github.com` - the manifest is a form POST to
GitHub. `render.yaml` and `deploy/dashboard/security-headers.conf` carry it.

### Correlating a run

`workflow_dispatch` is called with `return_run_details: true`
([changelog](https://github.blog/changelog/2026-02-19-workflow-dispatch-api-now-returns-run-ids)),
so the run's id is known before GitHub starts it and the dashboard shows the run at once. A run
started any other way (push, tag, pull request) arrives through `workflow_run`.

A repository can serve several apps. A run is attributed to every app linked to the repository
**and** the workflow path. When more than one app shares the same workflow, only runs started
from the dashboard (known by id) and runs a CLI deploy reports into are attributed.

### Missed webhooks

`POST /api/builds/:id/sync` reads the run and its jobs back from the provider. The dashboard calls
it while a run is open and live updates have gone quiet, which also makes a local server with no
public URL usable. Runs still unfinished after 24 hours are closed as failed.

## GitLab

The webhook already records pipelines. The pipeline event carries every job and the stage order,
so the plan comes from it rather than from `.gitlab-ci.yml`.

Starting a pipeline needs a **project access token** (`api` scope, Developer role) stored encrypted
the same way. The server must reach the GitLab instance; a GitLab behind a VPN cannot be triggered
from a server outside it. Started pipelines receive the `CAPUCHOO_*` variables of
`GITLAB_PIPELINE_VARIABLES`, which the generated `.gitlab-ci.yml` reads.

## API

All bodies are JSON. Roles are app roles unless marked.

### GitHub App (instance)

| Method | Path                       | Who            | Notes                                                       |
| ------ | -------------------------- | -------------- | ----------------------------------------------------------- |
| GET    | `/api/github/app`          | signed in      | `GithubAppStatus`                                           |
| POST   | `/api/github/app/manifest` | instance admin | `{ organization? }` -> `{ action, manifest }`; form POST it |
| GET    | `/api/github/app/callback` | browser        | GitHub redirects here; 302 to `/settings/github`            |
| DELETE | `/api/github/app`          | instance admin | stored App only                                             |

```ts
interface GithubAppStatus {
  configured: boolean;
  source: "env" | "database" | null;
  slug: string | null;
  name: string | null;
  html_url: string | null;
  owner: string | null;
  webhook_url: string;
  can_manage: boolean;
}
```

### Installations (organization)

| Method | Path                                                          | Who       |
| ------ | ------------------------------------------------------------- | --------- |
| GET    | `/api/organizations/:orgId/github`                            | member    |
| GET    | `/api/organizations/:orgId/github/install-url?return=/path`   | org admin |
| GET    | `/api/github/setup`                                           | browser   |
| DELETE | `/api/organizations/:orgId/github/installations/:id`          | org admin |
| GET    | `/api/organizations/:orgId/github/installations/:id/repositories?q=` | member |

```ts
interface OrganizationGithub {
  app: { configured: boolean; slug: string | null };
  can_manage: boolean;
  installations: GithubInstallation[];
}
interface GithubInstallation {
  id: string; // ours (uuid)
  installation_id: string; // GitHub's
  account_login: string;
  account_type: "User" | "Organization";
  repository_selection: "all" | "selected" | null;
  suspended_at: string | null;
  html_url: string;
  created_at: string;
}
interface GithubRepository {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  pushed_at: string | null;
}
// repositories: { repositories: GithubRepository[]; truncated: boolean }
// install-url: { url: string }
```

`/api/github/setup` redirects to the `return` path given to `install-url` (a same-site path only)
with `?github=linked` or `?github_error=<reason>`.

### App CI

| Method | Path                                         | Who       | Body / answer                                                |
| ------ | -------------------------------------------- | --------- | ------------------------------------------------------------ |
| GET    | `/api/apps/:id/ci`                           | viewer    | `AppCi`                                                      |
| PUT    | `/api/apps/:id/ci/github`                    | admin     | `{ installation, repository_id, workflow_path? }` -> `AppCi` |
| DELETE | `/api/apps/:id/ci/github`                    | admin     | 204                                                          |
| GET    | `/api/apps/:id/ci/github/setup`              | admin     | `GithubSetup`                                                |
| POST   | `/api/apps/:id/ci/github/setup/pull-request` | admin     | `{ dev_branch?, staging_branch?, clients?, app_dir? }`       |
| GET    | `/api/apps/:id/ci/github/public-key`         | admin     | `{ key_id, key }` (the repository's sealed-box key)          |
| PUT    | `/api/apps/:id/ci/github/secrets`            | admin     | `{ secrets: [{ name, encrypted_value, key_id }] }`           |
| PUT    | `/api/apps/:id/ci/github/variables`          | admin     | `{}` sets `CAPUCHOO_ENDPOINT` to this server                 |
| GET    | `/api/apps/:id/ci/refs`                      | developer | `{ default_branch, branches: string[], tags: string[] }`     |
| POST   | `/api/apps/:id/ci/runs`                      | developer | `CiRunRequest` fields -> 201 `{ build, html_url }`           |
| POST   | `/api/builds/:id/cancel`                     | developer | `{ build }`                                                  |
| POST   | `/api/builds/:id/rerun`                      | developer | `{ failed_only }` -> `{ build }`                             |
| POST   | `/api/builds/:id/sync`                       | viewer    | `BuildDetail`; at most once per 10 s per build               |
| PUT    | `/api/apps/:id/integrations/gitlab/trigger`  | admin     | `{ base_url, project, token }` -> `GitlabTrigger`            |
| DELETE | `/api/apps/:id/integrations/gitlab/trigger`  | admin     | 204                                                          |

```ts
interface AppCi {
  provider: "github" | "gitlab" | null;
  github: null | {
    installation: string;
    account_login: string;
    repository: { id: number; full_name: string; html_url: string; default_branch: string };
    workflow_path: string;
    connected_at: string;
    last_event_at: string | null;
  };
  gitlab: null | {
    project: string | null;
    base_url: string | null;
    can_trigger: boolean;
    last_event_at: string | null;
  };
  can_run: boolean;
}

interface GithubSetup {
  default_branch: string;
  workflow: {
    path: string;
    exists: boolean;
    generated: boolean; // carries the Capuchoo header
    version: string | null; // the Capuchoo version that generated it
    html_url: string | null;
  };
  pull_request: { number: number; html_url: string; state: "open" | "closed" | "merged" } | null;
  secrets: Array<{ name: GithubWorkflowSecret; present: boolean; required: "always" | "native" | "optional" }>;
  variable: { name: "CAPUCHOO_ENDPOINT"; value: string | null; expected: string };
  package_manager: "pnpm" | "npm" | "yarn" | "bun" | null;
}
```

Secrets are encrypted **in the browser** with the repository's public key (libsodium sealed box)
and the server only relays the ciphertext: the keystore and its passwords never reach Capuchoo.
The API key comes from `POST /api/api-keys` (`app_id` = the app, `role: "developer"`), whose
plaintext the dashboard already receives once.

### Builds

`GET /api/builds/:id` answers `BuildDetail`:

```ts
interface Build {
  // ...existing columns...
  parent_id: string | null;
  job_key: string | null;
  run_attempt: number | null;
  workflow: string | null;
  title: string | null;
  trigger: string | null; // push, pull_request, workflow_dispatch, tag, api, ...
}
interface BuildJob {
  id: string;
  build_id: string;
  external_id: string;
  plan_key: string | null;
  name: string;
  stage: string | null;
  status: JobStatus;
  attempt: number;
  url: string | null;
  runner: string | null;
  steps: PipelineStep[];
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}
interface BuildDetail extends Build {
  events: BuildEvent[];
  jobs: BuildJob[];
  plan: PipelinePlan | null;
  children: Build[];
}
```

`GET /api/apps/:id/builds?scope=top` leaves out child builds.

Live stream additions: `build_job` (a `BuildJob`); child builds arrive as `build` with
`parent_id` set.

### CLI

`POST /api/apps/:id/builds` accepts
`ci: { provider: "github" | "gitlab", run_id, run_attempt, job }`. The server attaches the build
to that run, creating the run's row if its webhook has not arrived yet.
