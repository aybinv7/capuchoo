<script setup lang="ts">
import { Play, RefreshCw } from "@lucide/vue";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import type { AppCiGithub } from "@/shared/types/ci";
import { useGithubSecrets } from "../../composables/useGithubSecrets";
import { useGithubSetup } from "../../composables/useGithubSetup";
import { ANDROID_SECRETS, otherSecrets, setupProgress } from "../../lib/github-setup";
import AndroidSigningStep from "./AndroidSigningStep.vue";
import ApiKeyStep from "./ApiKeyStep.vue";
import EndpointStep from "./EndpointStep.vue";
import OtherSecretsStep from "./OtherSecretsStep.vue";
import SetupStep from "./SetupStep.vue";
import WorkflowStep from "./WorkflowStep.vue";

const props = defineProps<{ appId: string; github: AppCiGithub; canRun: boolean }>();
const emit = defineEmits<{ run: [] }>();

const { setup, pullRequest, variable, refresh } = useGithubSetup(() => props.appId, true);
const secrets = useGithubSecrets(
  () => props.appId,
  () => props.github.repository.full_name,
);

const value = computed(() => setup.data.value ?? null);
const progress = computed(() => (value.value ? setupProgress(value.value) : null));
const apiKeyPresent = computed(
  () => value.value?.secrets.some((s) => s.name === "CAPUCHOO_API_KEY" && s.present) ?? false,
);
const androidCount = computed(
  () =>
    value.value?.secrets.filter(
      (s) => s.present && (ANDROID_SECRETS as readonly string[]).includes(s.name),
    ).length ?? 0,
);
const extra = computed(() => (value.value ? otherSecrets(value.value) : []));
</script>

<template>
  <ErrorNotice v-if="setup.error.value" :error="setup.error.value" :retry="setup.refetch" />
  <div v-else-if="setup.isPending.value || !value || !progress" class="space-y-3">
    <Skeleton v-for="index in 4" :key="index" class="h-14 w-full" />
  </div>
  <div v-else class="space-y-5">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm">
        <span class="font-medium tabular">{{ progress.done }} of {{ progress.total }}</span>
        <span class="text-muted-foreground"> required steps done</span>
      </p>
      <Button
        variant="ghost"
        size="xs"
        :disabled="setup.isFetching.value"
        aria-label="Check the repository again"
        @click="refresh"
      >
        <Spinner v-if="setup.isFetching.value" class="size-3" />
        <RefreshCw v-else />
        Check again
      </Button>
    </div>

    <ol>
      <SetupStep :index="1" title="Give it an API key" :state="progress.apiKey">
        <ApiKeyStep :present="apiKeyPresent" :api-key="secrets.apiKey" />
      </SetupStep>
      <SetupStep :index="2" title="Point it at this server" :state="progress.endpoint">
        <EndpointStep :setup="value" :variable="variable" />
      </SetupStep>
      <SetupStep :index="3" title="Add the workflow" :state="progress.workflow">
        <WorkflowStep :setup="value" :pull-request="pullRequest" />
      </SetupStep>
      <SetupStep :index="4" title="Sign Android releases" :state="progress.android">
        <AndroidSigningStep :configured="androidCount" :store="secrets.store" />
      </SetupStep>
      <SetupStep
        v-if="extra.length"
        :index="5"
        title="Other secrets"
        :state="extra.every((s) => s.present || s.required !== 'always') ? 'done' : 'todo'"
      >
        <OtherSecretsStep :secrets="extra" :store="secrets.store" />
      </SetupStep>
      <SetupStep
        :index="extra.length ? 6 : 5"
        title="Run your first pipeline"
        :state="props.canRun ? 'todo' : 'waiting'"
        last
      >
        <div class="space-y-2 text-sm">
          <p class="text-muted-foreground text-pretty">
            {{
              props.canRun
                ? "Rehearse first: it runs every step and uploads nothing."
                : "Available once the workflow is on the default branch."
            }}
          </p>
          <Button size="sm" :disabled="!props.canRun" @click="emit('run')">
            <Play />
            Run pipeline
          </Button>
        </div>
      </SetupStep>
    </ol>
  </div>
</template>
