<script setup lang="ts">
import { computed } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { firstRefusal } from "@/shared/lib/gate";
import { hasOrgRole } from "@/shared/lib/roles";
import AppGeneralForm from "../components/AppGeneralForm.vue";
import DeleteAppCard from "../components/DeleteAppCard.vue";
import IdentifiersCard from "../components/IdentifiersCard.vue";
import { useAppGeneral } from "../composables/useAppGeneral";

const { appId, app, orgRole } = useCurrentApp();
const permissions = useAppPermissions();
const general = useAppGeneral(appId);

const editable = computed(() => permissions.isAdmin.value);
const deleteGate = computed(() =>
  firstRefusal(
    permissions.administer.value,
    hasOrgRole(orgRole.value, "admin")
      ? { ok: true }
      : { ok: false, reason: "Deleting an app also requires the admin role in its organization." },
  ),
);
</script>

<template>
  <ErrorNotice
    v-if="general.detail.error.value"
    :error="general.detail.error.value"
    :retry="general.detail.refetch"
  />
  <Skeleton
    v-else-if="general.detail.isPending.value || !general.detail.data.value"
    class="h-48 w-full"
  />
  <template v-else>
    <AppGeneralForm
      :app="general.detail.data.value"
      :editable="editable"
      :update="general.update"
    />
    <IdentifiersCard
      :primary="general.detail.data.value.app_id"
      :identifiers="general.identifiers.data.value ?? []"
      :editable="editable"
      :add="general.addIdentifier"
      :remove="general.removeIdentifier"
    />
    <DeleteAppCard
      v-if="app"
      :app="app"
      :gate="deleteGate"
      :remove="general.remove"
      :refresh-session="general.refreshSession"
    />
  </template>
</template>
