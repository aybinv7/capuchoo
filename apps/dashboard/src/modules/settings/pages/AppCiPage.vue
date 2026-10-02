<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import RunPipelineDialogHost from "@/shared/ci/components/RunPipelineDialogHost.vue";
import { useRunPipelineDialog } from "@/shared/ci/composables/useRunPipelineDialog";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { queryKeys } from "@/shared/api/query-keys";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useAppCi } from "@/shared/queries/useAppCi";
import GithubSection from "../components/github/GithubSection.vue";
import GitlabTriggerCard from "../components/gitlab/GitlabTriggerCard.vue";
import GitlabWebhookCard from "../components/gitlab/GitlabWebhookCard.vue";
import { useGithubReturnNotice } from "../composables/useGithubReturnNotice";

const client = useQueryClient();
const { appId, organization } = useCurrentApp();
const permissions = useAppPermissions();
const isAdmin = computed(() => permissions.isAdmin.value);
const { ci, isPending, error, refetch } = useAppCi(appId);
const run = useRunPipelineDialog();

useGithubReturnNotice(() => {
  void client.invalidateQueries({ queryKey: queryKeys.appCi(appId.value) });
  if (organization.value)
    void client.invalidateQueries({
      queryKey: queryKeys.organization(organization.value.id, "github"),
    });
});
</script>

<template>
  <ErrorNotice v-if="error" :error="error" :retry="refetch" />
  <template v-else-if="isPending || !ci">
    <Skeleton class="h-48 w-full" />
    <Skeleton class="h-32 w-full" />
  </template>
  <template v-else>
    <GithubSection
      :app-id="appId"
      :ci="ci"
      :is-admin="isAdmin"
      @run="run.show({ action: 'check' })"
    />
    <GitlabWebhookCard :app-id="appId" :is-admin="isAdmin" />
    <GitlabTriggerCard
      v-if="isAdmin"
      :app-id="appId"
      :gitlab="ci.gitlab"
      :can-run="ci.can_run && ci.provider === 'gitlab'"
      @run="run.show()"
    />
  </template>
  <RunPipelineDialogHost :controller="run" />
</template>
