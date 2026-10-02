<script setup lang="ts">
import { CircleCheck, CircleDashed, Lock, SquareArrowOutUpRight } from "@lucide/vue";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ProviderIcon from "@/shared/components/ProviderIcon.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import type { AppCi } from "@/shared/types/ci";
import { useCiConnection } from "../../composables/useCiConnection";
import SettingsSection from "../SettingsSection.vue";
import GithubConnectPanel from "./GithubConnectPanel.vue";
import GithubSetupChecklist from "./GithubSetupChecklist.vue";

const props = defineProps<{ appId: string; ci: AppCi; isAdmin: boolean }>();
const emit = defineEmits<{ run: [] }>();

const { disconnect } = useCiConnection(() => props.appId);
const confirmDisconnect = ref(false);
const github = computed(() => props.ci.github);

function runDisconnect() {
  disconnect.mutate(undefined, {
    onSuccess: () => {
      confirmDisconnect.value = false;
      toast.success("GitHub disconnected");
    },
  });
}
</script>

<template>
  <SettingsSection
    title="GitHub Actions"
    description="Runs of the Capuchoo workflow appear in Builds with their job graph, and can be started from the dashboard."
  >
    <template #actions>
      <span v-if="github" class="text-success flex items-center gap-1.5 text-sm">
        <CircleCheck class="size-4" />
        Connected
      </span>
      <span v-else class="text-muted-foreground flex items-center gap-1.5 text-sm">
        <CircleDashed class="size-4" />
        Not connected
      </span>
    </template>

    <div v-if="github" class="space-y-6">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border px-4 py-3 text-sm">
        <a
          :href="github.repository.html_url"
          target="_blank"
          rel="noopener noreferrer"
          class="flex min-w-0 items-center gap-2 font-mono font-medium hover:underline"
        >
          <ProviderIcon provider="github" />
          <span class="truncate">{{ github.repository.full_name }}</span>
          <SquareArrowOutUpRight class="text-muted-foreground size-3.5" />
        </a>
        <span class="text-muted-foreground text-xs">
          <span class="font-mono">{{ github.workflow_path }}</span> on
          <span class="font-mono">{{ github.repository.default_branch }}</span>
        </span>
        <span class="text-muted-foreground ml-auto text-xs">
          Last event <RelativeTime :value="github.last_event_at" />
        </span>
      </div>

      <GithubSetupChecklist
        v-if="props.isAdmin"
        :app-id="props.appId"
        :github="github"
        :can-run="props.ci.can_run"
        @run="emit('run')"
      />
    </div>

    <p v-else-if="!props.isAdmin" class="text-muted-foreground flex items-center gap-2 text-sm">
      <Lock class="size-3.5" />
      An app admin connects a repository.
    </p>
    <GithubConnectPanel v-else />

    <template v-if="github && props.isAdmin" #footer>
      <Button variant="destructive" size="sm" @click="confirmDisconnect = true">Disconnect</Button>
    </template>
  </SettingsSection>

  <ConfirmDialog
    v-model:open="confirmDisconnect"
    :title="`Disconnect ${github?.repository.full_name ?? 'GitHub'}`"
    description="Runs stop being recorded and cannot be started from here. Secrets, the variable and the workflow stay in the repository; recorded builds stay here."
    confirm-label="Disconnect"
    destructive
    :pending="disconnect.isPending.value"
    :error="disconnect.error.value"
    @confirm="runDisconnect"
  />
</template>
