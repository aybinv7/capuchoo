import type { KeyObject } from "node:crypto";
import type { Deps } from "../http/context";
import { findGithubApp } from "../repositories/github-app";
import { parsePrivateKey } from "./app-jwt";

export interface GithubAppCredentials {
  source: "env" | "database";
  appId: string;
  slug: string;
  name: string;
  htmlUrl: string;
  owner: string | null;
  clientId: string;
  clientSecret: string;
  privateKey: KeyObject;
  webhookSecret: string;
}

const CACHE_MS = 60_000;

export const SECRET_PURPOSE = {
  privateKey: "github_app.private_key",
  clientSecret: "github_app.client_secret",
  webhookSecret: "github_app.webhook_secret",
} as const;

function fromEnv(deps: Deps): GithubAppCredentials | null {
  const c = deps.config;
  if (
    !c.GITHUB_APP_ID ||
    !c.GITHUB_APP_SLUG ||
    !c.GITHUB_APP_PRIVATE_KEY ||
    !c.GITHUB_WEBHOOK_SECRET
  )
    return null;
  return {
    source: "env",
    appId: c.GITHUB_APP_ID,
    slug: c.GITHUB_APP_SLUG,
    name: c.GITHUB_APP_SLUG,
    htmlUrl: `${c.GITHUB_WEB_URL.replace(/\/+$/, "")}/apps/${c.GITHUB_APP_SLUG}`,
    owner: null,
    clientId: c.GITHUB_CLIENT_ID ?? "",
    clientSecret: c.GITHUB_CLIENT_SECRET ?? "",
    privateKey: parsePrivateKey(c.GITHUB_APP_PRIVATE_KEY),
    webhookSecret: c.GITHUB_WEBHOOK_SECRET,
  };
}

async function fromDatabase(deps: Deps): Promise<GithubAppCredentials | null> {
  const row = await findGithubApp(deps.db);
  if (!row) return null;
  const box = deps.ci.secrets;
  try {
    return {
      source: "database",
      appId: String(row.app_id),
      slug: row.slug,
      name: row.name,
      htmlUrl: row.html_url,
      owner: row.owner_login,
      clientId: row.client_id,
      clientSecret: box.open(row.client_secret_enc, SECRET_PURPOSE.clientSecret),
      privateKey: parsePrivateKey(box.open(row.private_key_enc, SECRET_PURPOSE.privateKey)),
      webhookSecret: box.open(row.webhook_secret_enc, SECRET_PURPOSE.webhookSecret),
    };
  } catch (error) {
    deps.logger.error("the stored GitHub App cannot be decrypted; was SECRET_KEY changed?", {
      error,
    });
    return null;
  }
}

/** The GitHub App this server acts as: the environment's when set, else the one created here. */
export async function githubApp(deps: Deps): Promise<GithubAppCredentials | null> {
  const now = deps.now().getTime();
  const cached = deps.ci.appCache;
  if (cached && cached.expiresAt > now) return cached.value as GithubAppCredentials | null;
  const value = fromEnv(deps) ?? (await fromDatabase(deps));
  deps.ci.appCache = { value, expiresAt: now + CACHE_MS };
  return value;
}
