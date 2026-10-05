import type { App } from "@/domains/catalog/catalog.repository";
import { api } from "@/shared/api/endpoints";
import { ApiError } from "@/shared/api/http";
import type { ServerInvitation, ServerMember, ServerPermission } from "@/shared/api/types";
import type { AppRole } from "@/shared/database/schema";
import { credentials } from "@/shared/session/session";
import { bump } from "@/shared/utils/native/haptics";

export interface Person {
  userId: string;
  email: string;
  name: string;
  role: AppRole | null;
}

export type AddOutcome = "granted" | "no-account";

const toPerson = (row: ServerPermission | ServerMember, role: AppRole | null): Person => ({
  userId: row.user_id,
  email: row.users.email,
  name: row.users.full_name || row.users.email,
  role,
});

/**
 * Who works on the app, read from the server each time the screen opens and never kept on the
 * phone: colleagues' addresses are the server's to hold. Organization members without a role here
 * are listed so an admin can give one, and invitations show only to an organization admin.
 */
export function usePeople(app: Ref<App | null>) {
  const withAccess = ref<Person[]>([]);
  const withoutAccess = ref<Person[]>([]);
  const invitations = ref<ServerInvitation[] | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const messageOf = (failure: unknown) =>
    failure instanceof Error ? failure.message : String(failure);

  async function load(): Promise<void> {
    const current = app.value;
    if (!current) return;
    loading.value = true;
    try {
      const c = credentials();
      const [permissions, members, pending] = await Promise.all([
        api.permissions(c, current.id),
        api.members(c, current.organization_id).catch(() => [] as ServerMember[]),
        api.invitations(c, current.organization_id).catch(() => null),
      ]);
      const granted = new Set(permissions.map((row) => row.user_id));
      withAccess.value = permissions
        .map((row) => toPerson(row, row.role))
        .sort((a, b) => a.name.localeCompare(b.name));
      withoutAccess.value = members
        .filter((row) => !granted.has(row.user_id))
        .map((row) => toPerson(row, null))
        .sort((a, b) => a.name.localeCompare(b.name));
      invitations.value = pending;
      error.value = null;
    } catch (failure) {
      error.value = messageOf(failure);
    } finally {
      loading.value = false;
    }
  }

  /** A role for an address; one with no account comes back as `no-account`, nothing sent. */
  async function setRole(email: string, role: AppRole): Promise<AddOutcome> {
    const current = app.value;
    if (!current) throw new Error("No app selected");
    try {
      await api.grant(credentials(), current.id, email.trim().toLowerCase(), role);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) return "no-account";
      throw failure;
    }
    bump();
    await load();
    return "granted";
  }

  /** Returns the link to send: the server sends no mail, so the admin shares it themselves. */
  async function invite(email: string): Promise<string> {
    const current = app.value;
    if (!current) throw new Error("No app selected");
    const created = await api.invite(
      credentials(),
      current.organization_id,
      email.trim().toLowerCase(),
    );
    bump();
    await load();
    return created.invitation.url;
  }

  async function revoke(person: Person): Promise<void> {
    const current = app.value;
    if (!current) return;
    await api.revoke(credentials(), current.id, person.userId);
    bump();
    await load();
  }

  async function cancelInvitation(invitation: ServerInvitation): Promise<void> {
    const current = app.value;
    if (!current) return;
    await api.revokeInvitation(credentials(), current.organization_id, invitation.id);
    await load();
  }

  return {
    withAccess,
    withoutAccess,
    invitations,
    loading,
    error,
    load,
    setRole,
    invite,
    revoke,
    cancelInvitation,
  };
}
