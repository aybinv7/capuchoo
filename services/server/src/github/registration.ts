import type { Principal } from "../auth/principal";
import type { Deps } from "../http/context";
import { badRequest, conflict, forbidden } from "../lib/errors";
import { deleteGithubApp, saveGithubApp } from "../repositories/github-app";
import { SECRET_PURPOSE, githubApp } from "./credentials";
import { githubCall } from "./http";
import { transport } from "./client";

const MANIFEST_STATE = "github-manifest";
const STATE_TTL_MS = 60 * 60_000;
const ORG_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

export interface ManifestRequest {
  organization?: string | null;
  visibility?: "private" | "public";
  name?: string | null;
}

/** What GitHub needs to create the App, pointing every URL back at this server. */
export function buildManifest(baseUrl: string, input: ManifestRequest): Record<string, unknown> {
  const host = new URL(baseUrl).host;
  const name = (input.name?.trim() || `Capuchoo ${host}`).slice(0, 34);
  return {
    name,
    url: baseUrl,
    description: "Records CI runs, starts pipelines and sets repositories up for Capuchoo.",
    hook_attributes: { url: `${baseUrl}/api/integrations/github/webhook`, active: true },
    redirect_url: `${baseUrl}/api/github/app/callback`,
    callback_urls: [`${baseUrl}/api/github/setup`],
    setup_url: `${baseUrl}/api/github/setup`,
    setup_on_update: true,
    request_oauth_on_install: true,
    public: input.visibility === "public",
    default_permissions: {
      actions: "write",
      actions_variables: "write",
      contents: "write",
      metadata: "read",
      pull_requests: "write",
      secrets: "write",
      workflows: "write",
    },
    default_events: ["workflow_run", "workflow_job"],
  };
}

/** The form an instance admin submits to GitHub to create the App. */
export async function manifestForm(
  deps: Deps,
  who: Principal,
  baseUrl: string,
  input: ManifestRequest,
): Promise<{ action: string; manifest: string }> {
  if (!who.isInstanceAdmin) throw forbidden("Only an instance admin can create the GitHub App");
  const existing = await githubApp(deps);
  if (existing) {
    throw conflict(
      existing.source === "env"
        ? "The GitHub App is set by the server's environment"
        : "A GitHub App already exists; delete it first",
      "github_app_exists",
    );
  }
  const organization = input.organization?.trim() || null;
  if (organization && !ORG_LOGIN.test(organization))
    throw badRequest("Not a GitHub organization name", "bad_org");
  const state = deps.ci.states.sign(
    MANIFEST_STATE,
    { u: who.userId },
    new Date(deps.now().getTime() + STATE_TTL_MS),
  );
  const web = deps.config.GITHUB_WEB_URL.replace(/\/+$/, "");
  const path = organization
    ? `/organizations/${encodeURIComponent(organization)}/settings/apps/new`
    : "/settings/apps/new";
  return {
    action: `${web}${path}?state=${encodeURIComponent(state)}`,
    manifest: JSON.stringify(buildManifest(baseUrl, input)),
  };
}

interface Conversion {
  id: number;
  slug: string;
  name: string;
  html_url: string;
  client_id: string;
  client_secret: string;
  webhook_secret: string;
  pem: string;
  owner?: { login?: string } | null;
}

/** Trades the one-time code GitHub redirected with for the App's credentials, and stores them sealed. */
export async function completeManifest(
  deps: Deps,
  who: Principal,
  code: string | undefined,
  state: string | undefined,
): Promise<{ slug: string }> {
  const claims = deps.ci.states.verify<{ u: string }>(MANIFEST_STATE, state, deps.now());
  if (!claims || claims.u !== who.userId || !who.isInstanceAdmin)
    throw forbidden("This GitHub App link expired or is not yours");
  if (!code || !/^[A-Za-z0-9_-]{1,100}$/.test(code))
    throw badRequest("GitHub did not send a code", "github_code");
  if (await githubApp(deps)) throw conflict("A GitHub App already exists", "github_app_exists");

  const { data } = await githubCall<Conversion>(
    transport(deps),
    "POST",
    `/app-manifests/${encodeURIComponent(code)}/conversions`,
  );
  if (!data?.id || !data.pem || !data.webhook_secret || !data.client_secret) {
    throw conflict("GitHub answered without the App's credentials", "github_conversion");
  }
  const box = deps.ci.secrets;
  await saveGithubApp(deps.db, {
    app_id: data.id,
    slug: data.slug,
    name: data.name,
    html_url: data.html_url,
    owner_login: data.owner?.login ?? null,
    client_id: data.client_id,
    client_secret_enc: box.seal(data.client_secret, SECRET_PURPOSE.clientSecret),
    private_key_enc: box.seal(data.pem, SECRET_PURPOSE.privateKey),
    webhook_secret_enc: box.seal(data.webhook_secret, SECRET_PURPOSE.webhookSecret),
    created_by: who.userId,
  });
  deps.ci.forgetApp();
  return { slug: data.slug };
}

/** Forgets the stored App. Its installations stop working; the App itself stays on GitHub. */
export async function removeStoredApp(deps: Deps, who: Principal): Promise<boolean> {
  if (!who.isInstanceAdmin) throw forbidden("Only an instance admin can remove the GitHub App");
  const removed = await deleteGithubApp(deps.db);
  deps.ci.forgetApp();
  return removed;
}
