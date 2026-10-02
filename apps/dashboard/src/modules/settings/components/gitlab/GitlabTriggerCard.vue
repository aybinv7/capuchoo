<script setup lang="ts">
import { CircleCheck, CircleDashed, Play } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import type { AppCiGitlab } from "@/shared/types/ci";
import { useCiConnection } from "../../composables/useCiConnection";
import SettingsSection from "../SettingsSection.vue";

const props = defineProps<{ appId: string; gitlab: AppCiGitlab | null; canRun: boolean }>();
const emit = defineEmits<{ run: [] }>();

const { saveTrigger, removeTrigger } = useCiConnection(() => props.appId);
const baseUrl = ref("https://gitlab.com");
const project = ref("");
const token = ref("");
const editing = ref(false);
const confirmRemove = ref(false);
const problem = ref<string | null>(null);

const canTrigger = computed(() => props.gitlab?.can_trigger ?? false);
const showForm = computed(() => !canTrigger.value || editing.value);

watch(
  () => props.gitlab,
  (value) => {
    if (value?.base_url) baseUrl.value = value.base_url;
    if (value?.project) project.value = value.project;
  },
  { immediate: true },
);

function validUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function save() {
  problem.value = null;
  const base = baseUrl.value.trim().replace(/\/+$/, "");
  if (!validUrl(base)) {
    problem.value = "The GitLab address must be an https URL.";
    return;
  }
  if (!project.value.trim() || !token.value.trim()) {
    problem.value = "Both the project and the token are needed.";
    return;
  }
  saveTrigger.mutate(
    { base_url: base, project: project.value.trim(), token: token.value.trim() },
    {
      onSuccess: () => {
        editing.value = false;
        toast.success("Pipelines can now be started from Capuchoo");
      },
      onSettled: () => {
        token.value = "";
      },
    },
  );
}

function remove() {
  removeTrigger.mutate(undefined, {
    onSuccess: () => {
      confirmRemove.value = false;
      toast.success("GitLab trigger removed");
    },
  });
}
</script>

<template>
  <SettingsSection
    title="Start pipelines from Capuchoo"
    description="A project access token lets the dashboard start the Capuchoo pipeline. The server must be able to reach the GitLab instance."
  >
    <template #actions>
      <span v-if="canTrigger" class="text-success flex items-center gap-1.5 text-sm">
        <CircleCheck class="size-4" />
        Ready
      </span>
      <span v-else class="text-muted-foreground flex items-center gap-1.5 text-sm">
        <CircleDashed class="size-4" />
        Not set up
      </span>
    </template>

    <div class="space-y-4">
      <div v-if="canTrigger && !editing" class="flex flex-wrap items-center gap-3 text-sm">
        <span class="font-mono">{{ props.gitlab?.project }}</span>
        <span class="text-muted-foreground font-mono text-xs">{{ props.gitlab?.base_url }}</span>
        <Button
          v-if="props.canRun"
          size="sm"
          variant="outline"
          class="ml-auto"
          @click="emit('run')"
        >
          <Play />
          Run pipeline
        </Button>
      </div>

      <form v-if="showForm" class="space-y-4" autocomplete="off" @submit.prevent="save">
        <FieldGroup class="gap-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel for="gl-base">GitLab address</FieldLabel>
              <Input id="gl-base" v-model="baseUrl" class="font-mono" spellcheck="false" />
            </Field>
            <Field>
              <FieldLabel for="gl-project">Project</FieldLabel>
              <Input
                id="gl-project"
                v-model="project"
                class="font-mono"
                placeholder="group/project or 1234"
                spellcheck="false"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel for="gl-token">Project access token</FieldLabel>
            <Input
              id="gl-token"
              v-model="token"
              type="password"
              class="font-mono"
              autocomplete="new-password"
              placeholder="glpat-…"
            />
            <FieldDescription>
              Create it under the project's Settings → Access tokens with the
              <code class="font-mono">api</code> scope and the Developer role. It is stored
              encrypted and never shown again.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <p v-if="problem" class="text-destructive text-sm">{{ problem }}</p>
        <ErrorNotice v-if="saveTrigger.error.value" :error="saveTrigger.error.value" />
        <div class="flex justify-end gap-2">
          <Button v-if="editing" type="button" variant="ghost" size="sm" @click="editing = false">
            Cancel
          </Button>
          <Button type="submit" size="sm" :disabled="saveTrigger.isPending.value">
            <Spinner v-if="saveTrigger.isPending.value" />
            Save token
          </Button>
        </div>
      </form>
    </div>

    <template v-if="canTrigger && !editing" #footer>
      <Button variant="outline" size="sm" @click="editing = true">Replace token</Button>
      <Button variant="destructive" size="sm" @click="confirmRemove = true">Remove</Button>
    </template>
  </SettingsSection>

  <ConfirmDialog
    v-model:open="confirmRemove"
    title="Stop starting GitLab pipelines from here"
    description="The stored token is deleted. Revoke it in GitLab as well. Pipelines keep being recorded through the webhook."
    confirm-label="Remove"
    destructive
    :pending="removeTrigger.isPending.value"
    :error="removeTrigger.error.value"
    @confirm="remove"
  />
</template>
