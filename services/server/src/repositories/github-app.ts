import type { Db } from "../db/database";
import type { GithubAppTable } from "../db/schema";
import type { Insertable } from "kysely";

export function findGithubApp(db: Db) {
  return db.selectFrom("github_app").selectAll().where("id", "=", 1).executeTakeFirst();
}

export async function saveGithubApp(
  db: Db,
  row: Omit<Insertable<GithubAppTable>, "id">,
): Promise<void> {
  await db
    .insertInto("github_app")
    .values({ ...row, id: 1 })
    .onConflict((oc) => oc.column("id").doUpdateSet({ ...row }))
    .execute();
}

export async function deleteGithubApp(db: Db): Promise<boolean> {
  const result = await db.deleteFrom("github_app").where("id", "=", 1).executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}
