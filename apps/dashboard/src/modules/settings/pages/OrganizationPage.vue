<script setup lang="ts">
import { Building2 } from "@lucide/vue";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentOrganization } from "@/shared/composables/useCurrentOrganization";
import { useSession } from "@/shared/composables/useSession";
import { canManageMembers } from "@/shared/lib/roles";
import { RouteName } from "@/shared/router/route-names";
import type { OrgRole } from "@/shared/types/session";
import InviteMemberForm from "../components/InviteMemberForm.vue";
import MembersTable from "../components/MembersTable.vue";
import PendingInvitations from "../components/PendingInvitations.vue";
import SettingsSection from "../components/SettingsSection.vue";
import { useOrganizationMembers } from "../composables/useOrganizationMembers";
import type { Member } from "../types/settings.types";

const router = useRouter();
const { organization, role } = useCurrentOrganization();
const { user } = useSession();
const gate = computed(() => canManageMembers(role.value));
const { members, invitations, invite, changeRole, remove, revoke } = useOrganizationMembers(
  () => organization.value?.id ?? "",
  () => gate.value.ok,
);

const revision = ref(0);
const removing = ref<Member | null>(null);
const removeOpen = ref(false);
const leaving = computed(() => removing.value?.user_id === user.value?.id);

function setRole(member: Member, next: OrgRole) {
  changeRole.mutate(
    { userId: member.user_id, role: next },
    {
      onSuccess: () => toast.success(`${member.users.email} is now ${next}`),
      onError: () => {
        revision.value += 1;
      },
    },
  );
}

function askRemove(member: Member) {
  removing.value = member;
  removeOpen.value = true;
}

function confirmRemove() {
  const member = removing.value;
  if (!member) return;
  const self = leaving.value;
  remove.mutate(member.user_id, {
    onSuccess: () => {
      removeOpen.value = false;
      if (self) void router.push({ name: RouteName.apps });
    },
  });
}
</script>

<template>
  <PageContainer>
    <PageHeader
      :title="organization?.name ?? 'Organization'"
      :description="organization ? `You are ${organization.role} of this organization.` : undefined"
    />
    <EmptyState v-if="!organization" :icon="Building2" title="No organization selected" />
    <template v-else>
      <SettingsSection
        v-if="gate.ok"
        title="Invite"
        description="Someone with an account is added at once; anyone else gets a one-time link."
      >
        <InviteMemberForm :invite="invite" :can-grant-owner="organization.role === 'owner'" />
      </SettingsSection>

      <SettingsSection
        title="Members"
        description="Owners and admins are admins of every app in the organization. Only an owner grants or removes ownership, and the last owner stays."
      >
        <ErrorNotice
          v-if="members.error.value"
          :error="members.error.value"
          :retry="members.refetch"
        />
        <Skeleton v-else-if="members.isPending.value" class="h-32 w-full" />
        <MembersTable
          v-else
          :members="members.data.value ?? []"
          :self-id="user?.id ?? null"
          :actor-role="organization.role"
          :revision="revision"
          :pending-user-id="
            changeRole.isPending.value ? (changeRole.variables.value?.userId ?? null) : null
          "
          @role="setRole"
          @remove="askRemove"
        />
      </SettingsSection>

      <SettingsSection v-if="gate.ok" title="Pending invitations">
        <ErrorNotice v-if="invitations.error.value" :error="invitations.error.value" />
        <PendingInvitations
          v-else
          :invitations="invitations.data.value ?? []"
          :pending-id="revoke.isPending.value ? (revoke.variables.value ?? null) : null"
          @revoke="revoke.mutate($event.id)"
        />
      </SettingsSection>
    </template>

    <ConfirmDialog
      v-model:open="removeOpen"
      :title="leaving ? `Leave ${organization?.name}` : `Remove ${removing?.users.email}`"
      :description="
        leaving
          ? 'You lose access to its apps unless you hold a direct app role.'
          : 'They lose access to the organization and its apps, except direct app roles.'
      "
      :confirm-label="leaving ? 'Leave' : 'Remove member'"
      destructive
      :pending="remove.isPending.value"
      @confirm="confirmRemove"
    />
  </PageContainer>
</template>
