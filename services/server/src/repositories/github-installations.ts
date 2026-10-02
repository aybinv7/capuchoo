import type { Db } from "../db/database";
import type { GithubInstallation } from "../db/schema";

export interface InstallationAccount {
  installationId: string;
  accountLogin: string;
  accountType: "User" | "Organization";
  repositorySelection: "all" | "selected" | null;
  suspendedAt: Date | null;
}

export function listOrganizationInstallations(db: Db, organizationId: string) {
  return db
    .selectFrom("github_installations")
    .selectAll()
    .where("organization_id", "=", organizationId)
    .orderBy("created_at")
    .execute();
}

export function findOrganizationInstallation(
  db: Db,
  organizationId: string,
  id: string,
): Promise<GithubInstallation | undefined> {
  return db
    .selectFrom("github_installations")
    .selectAll()
    .where("organization_id", "=", organizationId)
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function linkInstallation(
  db: Db,
  input: InstallationAccount & { organizationId: string; createdBy: string },
): Promise<GithubInstallation> {
  const values = {
    account_login: input.accountLogin,
    account_type: input.accountType,
    repository_selection: input.repositorySelection,
    suspended_at: input.suspendedAt,
  };
  return db
    .insertInto("github_installations")
    .values({
      ...values,
      organization_id: input.organizationId,
      installation_id: input.installationId,
      created_by: input.createdBy,
    })
    .onConflict((oc) =>
      oc
        .columns(["organization_id", "installation_id"])
        .doUpdateSet({ ...values, updated_at: new Date() }),
    )
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** Mirrors an installation event onto every organization that linked it. */
export async function updateInstallationState(
  db: Db,
  installationId: string,
  patch: Partial<Pick<InstallationAccount, "accountLogin" | "repositorySelection" | "suspendedAt">>,
): Promise<void> {
  const set = {
    ...(patch.accountLogin !== undefined ? { account_login: patch.accountLogin } : {}),
    ...(patch.repositorySelection !== undefined
      ? { repository_selection: patch.repositorySelection }
      : {}),
    ...(patch.suspendedAt !== undefined ? { suspended_at: patch.suspendedAt } : {}),
  };
  if (Object.keys(set).length === 0) return;
  await db
    .updateTable("github_installations")
    .set({ ...set, updated_at: new Date() })
    .where("installation_id", "=", installationId)
    .execute();
}

export async function removeInstallationEverywhere(
  db: Db,
  installationId: string,
): Promise<number> {
  const result = await db
    .deleteFrom("github_installations")
    .where("installation_id", "=", installationId)
    .executeTakeFirst();
  return Number(result.numDeletedRows);
}

export async function unlinkInstallation(
  db: Db,
  organizationId: string,
  id: string,
): Promise<GithubInstallation | undefined> {
  return db
    .deleteFrom("github_installations")
    .where("organization_id", "=", organizationId)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
}
