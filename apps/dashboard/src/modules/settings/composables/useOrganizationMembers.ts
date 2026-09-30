import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { notifyError } from "@/shared/lib/notify";
import type { OrgRole } from "@/shared/types/session";
import {
  changeMemberRole,
  fetchInvitations,
  fetchMembers,
  inviteMember,
  removeMember,
  revokeInvitation,
} from "../services/organization.service";

/**
 * Members and pending invitations of one organization. Who may grant or remove ownership is the
 * server's rule; a refusal comes back as a toast with its message.
 */
export function useOrganizationMembers(
  organizationId: MaybeRefOrGetter<string>,
  canManage: MaybeRefOrGetter<boolean>,
) {
  const client = useQueryClient();
  const id = () => toValue(organizationId);
  const membersKey = computed(() => queryKeys.organization(id(), "members"));
  const invitationsKey = computed(() => queryKeys.organization(id(), "invitations"));

  const members = useQuery({
    queryKey: membersKey,
    queryFn: ({ signal }) => fetchMembers(id(), signal),
    enabled: computed(() => Boolean(id())),
  });

  const invitations = useQuery({
    queryKey: invitationsKey,
    queryFn: ({ signal }) => fetchInvitations(id(), signal),
    enabled: computed(() => Boolean(id()) && toValue(canManage)),
  });

  const refresh = () => {
    void client.invalidateQueries({ queryKey: membersKey.value });
    void client.invalidateQueries({ queryKey: invitationsKey.value });
  };

  const invite = useMutation({
    mutationFn: ({ email, role }: { email: string; role: OrgRole }) =>
      inviteMember(id(), email, role),
    onSuccess: refresh,
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      changeMemberRole(id(), userId, role),
    onSuccess: refresh,
    onError: (error) => {
      notifyError(error);
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (userId: string) => removeMember(id(), userId),
    onSuccess: () => {
      refresh();
      void client.invalidateQueries({ queryKey: queryKeys.me() });
    },
    onError: notifyError,
  });

  const revoke = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(id(), invitationId),
    onSuccess: refresh,
    onError: notifyError,
  });

  return { members, invitations, invite, changeRole, remove, revoke };
}
