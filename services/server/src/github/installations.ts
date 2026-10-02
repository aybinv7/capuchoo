import { sql } from "kysely";
import { requireOrgRole } from "../access/app-access";
import type { Principal } from "../auth/principal";
import type { GithubInstallation } from "../db/schema";
import type { Deps } from "../http/context";
import { badRequest, notFound } from "../lib/errors";
import {
  findOrganizationInstallation,
  linkInstallation,
  listOrganizationInstallations,
  unlinkInstallation,
} from "../repositories/github-installations";
import { asApp, asInstallation, asUser, exchangeUserCode, requireGithubApp } from "./client";
import { githubApp } from "./credentials";
import { asRecord, asText } from "./run-mapper";

const INSTALL_STATE = "github-install";
const STATE_TTL_MS = 60 * 60_000;

/** A same-site path to come back to; anything else becomes the organization page. */
export function safeReturnPath(value: unknown): string {
  return typeof value === "string" &&
    value.length <= 300 &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\u0000-\u001f]/.test(value)
    ? value
    : "/settings/organization";
}

export function serializeInstallation(row: GithubInstallation, webUrl: string) {
  const base = webUrl.replace(/\/+$/, "");
  return {
    id: row.id,
    installation_id: String(row.installation_id),
    account_login: row.account_login,
    account_type: row.account_type,
    repository_selection: row.repository_selection,
    suspended_at: row.suspended_at,
    html_url:
      row.account_type === "Organization"
        ? `${base}/organizations/${row.account_login}/settings/installations/${row.installation_id}`
        : `${base}/settings/installations/${row.installation_id}`,
    created_at: row.created_at,
  };
}

export async function organizationGithub(deps: Deps, who: Principal, organizationId: string) {
  const role = await requireOrgRole(deps.db, who, organizationId, "member");
  const app = await githubApp(deps);
  const rows = await listOrganizationInstallations(deps.db, organizationId);
  return {
    app: { configured: Boolean(app), slug: app?.slug ?? null },
    can_manage: role === "owner" || role === "admin" || who.isInstanceAdmin,
    installations: rows.map((row) => serializeInstallation(row, deps.config.GITHUB_WEB_URL)),
  };
}

export async function installUrl(
  deps: Deps,
  who: Principal,
  organizationId: string,
  returnPath: unknown,
) {
  await requireOrgRole(deps.db, who, organizationId, "admin");
  const app = await requireGithubApp(deps);
  const state = deps.ci.states.sign(
    INSTALL_STATE,
    { u: who.userId, o: organizationId, r: safeReturnPath(returnPath) },
    new Date(deps.now().getTime() + STATE_TTL_MS),
  );
  const web = deps.config.GITHUB_WEB_URL.replace(/\/+$/, "");
  return { url: `${web}/apps/${app.slug}/installations/new?state=${encodeURIComponent(state)}` };
}

export interface SetupQuery {
  installation_id?: string;
  setup_action?: string;
  state?: string;
  code?: string;
}

export type SetupOutcome =
  | { returnPath: string; result: "linked" }
  | { returnPath: string; error: string };

async function userCanSee(deps: Deps, userToken: string, installationId: string): Promise<boolean> {
  const { items } = await asUser(deps, userToken).list<{ id?: unknown }>("/user/installations", {
    key: "installations",
    limit: 1000,
  });
  return items.some((item) => String(item.id) === installationId);
}

async function revokeUserToken(deps: Deps, token: string): Promise<void> {
  const app = await githubApp(deps);
  if (!app?.clientId || !app.clientSecret) return;
  const basic = Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64");
  await deps.ci
    .fetch(`${deps.config.GITHUB_API_URL.replace(/\/+$/, "")}/applications/${app.clientId}/token`, {
      method: "DELETE",
      headers: {
        authorization: `Basic ${basic}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "user-agent": "capuchoo-server",
      },
      body: JSON.stringify({ access_token: token }),
      signal: AbortSignal.timeout(deps.config.CI_REQUEST_TIMEOUT_MS),
    })
    .catch(() => undefined);
}

/**
 * Where GitHub sends the browser after an install. The installation id in the query is only a
 * claim: it is linked once the signed-in user's own GitHub token proves they can see it, so an id
 * read off someone else's screen links nothing.
 */
export async function completeSetup(
  deps: Deps,
  who: Principal | null,
  query: SetupQuery,
): Promise<SetupOutcome> {
  const claims = deps.ci.states.verify<{ u: string; o: string; r: string }>(
    INSTALL_STATE,
    query.state,
    deps.now(),
  );
  const returnPath = safeReturnPath(claims?.r);
  if (!claims) return { returnPath, error: "expired" };
  if (!who || who.userId !== claims.u) return { returnPath, error: "signed_out" };
  if (query.setup_action === "request") return { returnPath, error: "requested" };
  const installationId = query.installation_id?.trim() ?? "";
  if (!/^\d{1,20}$/.test(installationId)) return { returnPath, error: "no_installation" };
  if (!query.code) return { returnPath, error: "unverified" };

  try {
    await requireOrgRole(deps.db, who, claims.o, "admin");
  } catch {
    return { returnPath, error: "forbidden" };
  }
  const userToken = await exchangeUserCode(deps, query.code);
  if (!userToken) return { returnPath, error: "unverified" };
  try {
    if (!(await userCanSee(deps, userToken, installationId)))
      return { returnPath, error: "not_yours" };
  } finally {
    await revokeUserToken(deps, userToken);
  }

  const app = await asApp(deps);
  const installation = asRecord(
    await app.call<unknown>("GET", `/app/installations/${installationId}`),
  );
  const account = asRecord(installation.account);
  const login = asText(account.login);
  if (!login) return { returnPath, error: "no_installation" };
  const selection = installation.repository_selection;
  await linkInstallation(deps.db, {
    organizationId: claims.o,
    installationId,
    accountLogin: login,
    accountType: account.type === "Organization" ? "Organization" : "User",
    repositorySelection: selection === "all" || selection === "selected" ? selection : null,
    suspendedAt:
      typeof installation.suspended_at === "string" ? new Date(installation.suspended_at) : null,
    createdBy: who.userId,
  });
  return { returnPath, result: "linked" };
}

/** Unlinks an installation from an organization and disconnects the apps that used it there. */
export async function unlinkOrganizationInstallation(
  deps: Deps,
  who: Principal,
  organizationId: string,
  id: string,
) {
  await requireOrgRole(deps.db, who, organizationId, "admin");
  const removed = await unlinkInstallation(deps.db, organizationId, id);
  if (!removed) throw notFound("Installation");
  await deps.db
    .deleteFrom("integrations")
    .where("kind", "=", "github")
    .where(sql<string>`config->>'installation'`, "=", removed.id)
    .execute();
  return removed;
}

/** An installation of this organization, or 404. */
export async function requireInstallation(
  deps: Deps,
  organizationId: string,
  id: string,
): Promise<GithubInstallation> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound("Installation");
  const row = await findOrganizationInstallation(deps.db, organizationId, id);
  if (!row) throw notFound("Installation");
  if (row.suspended_at)
    throw badRequest("This GitHub installation is suspended", "github_suspended");
  return row;
}

export interface RepositorySummary {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  pushed_at: string | null;
}

export function summarizeRepository(raw: unknown): RepositorySummary | null {
  const repo = asRecord(raw);
  if (typeof repo.id !== "number" || typeof repo.full_name !== "string") return null;
  return {
    id: repo.id,
    full_name: repo.full_name,
    private: repo.private === true,
    default_branch: asText(repo.default_branch) ?? "main",
    html_url: asText(repo.html_url, 2000) ?? "",
    pushed_at: asText(repo.pushed_at),
  };
}

export async function installationRepositories(
  deps: Deps,
  who: Principal,
  organizationId: string,
  id: string,
  search: string | undefined,
) {
  await requireOrgRole(deps.db, who, organizationId, "member");
  const installation = await requireInstallation(deps, organizationId, id);
  const { items, truncated } = await asInstallation(
    deps,
    String(installation.installation_id),
  ).list<unknown>("/installation/repositories", { key: "repositories", limit: 1000 });
  const needle = search?.trim().toLowerCase();
  const repositories = items
    .map(summarizeRepository)
    .filter((repo): repo is RepositorySummary => repo !== null)
    .filter((repo) => !needle || repo.full_name.toLowerCase().includes(needle))
    .sort((a, b) => (b.pushed_at ?? "").localeCompare(a.pushed_at ?? ""))
    .slice(0, 200);
  return { repositories, truncated };
}
