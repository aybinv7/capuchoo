import {
  getAccount,
  listAppRows,
  listOrganizations,
  setAppNotify,
} from "@/domains/catalog/catalog.repository";
import { api } from "@/shared/api/endpoints";
import { getDatabase, rdb, useReactiveQuery } from "@/shared/database";
import { session } from "@/shared/session/session";
import { endSession } from "@/shared/sync/useSync";

async function loadProfile() {
  const db = getDatabase().db;
  const [account, organizations, apps] = await Promise.all([
    getAccount(db),
    listOrganizations(db),
    listAppRows(db),
  ]);
  return { account: account ?? null, organizations, apps };
}

export function useProfile() {
  const query = useReactiveQuery(loadProfile, {
    tables: ["account", "organization", "app"],
    queryKey: ["profile"],
  });

  const signingOut = ref(false);

  /** Revokes the session on the server, then forgets it here, whatever the server answered. */
  async function signOut(): Promise<void> {
    signingOut.value = true;
    try {
      if (session.value) await api.logout(session.value).catch(() => undefined);
      await endSession();
    } finally {
      signingOut.value = false;
    }
  }

  async function setNotify(appId: string, notify: boolean): Promise<void> {
    await setAppNotify(rdb, appId, notify);
  }

  return { profile: query.data, signingOut, signOut, setNotify };
}
