<script setup lang="ts">
import { CircleCheck, CircleDashed, TriangleAlert } from "@lucide/vue";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import GitlabSetupSteps from "./GitlabSetupSteps.vue";
import SettingsSection from "../SettingsSection.vue";
import { useGitlab } from "../../composables/useGitlab";

const props = defineProps<{ appId: string; isAdmin: boolean }>();
const { status, connect, disconnect } = useGitlab(
  () => props.appId,
  () => props.isAdmin,
);

const project = ref("");
const token = ref<string | null>(null);
const confirmRotate = ref(false);
const confirmDisconnect = ref(false);

const configured = computed(() => status.data.value?.configured ?? false);
const webhookUrl = computed(() => status.data.value?.webhook_url ?? "");

function runConnect() {
  connect.mutate(project.value.trim() || null, {
    onSuccess: (result) => {
      token.value = result.token;
      confirmRotate.value = false;
      toast.success(configured.value ? "Secret rotated" : "GitLab connected");
    },
  });
}

function runDisconnect() {
  disconnect.mutate(undefined, {
    onSuccess: () => {
      token.value = null;
      confirmDisconnect.value = false;
      toast.success("GitLab disconnected");
    },
  });
}
</script>

<template>
  <SettingsSection
    v-if="!props.isAdmin"
    title="GitLab pipelines"
    description="Only app admins can see or change the GitLab integration."
  />
  <template v-else>
    <ErrorNotice v-if="status.error.value" :error="status.error.value" :retry="status.refetch" />
    <Skeleton v-else-if="status.isPending.value" class="h-40 w-full" />
    <template v-else>
      <SettingsSection
        title="GitLab pipelines"
        description="GitLab calls the server on pipeline and job events; runs show up in Builds with their job graph."
      >
        <template #actions>
          <span v-if="configured" class="text-success flex items-center gap-1.5 text-sm">
            <CircleCheck class="size-4" />
            Connected
          </span>
          <span v-else class="text-muted-foreground flex items-center gap-1.5 text-sm">
            <CircleDashed class="size-4" />
            Not connected
          </span>
        </template>

        <div class="space-y-5">
          <p v-if="configured" class="text-muted-foreground text-sm">
            Last event:
            <RelativeTime :value="status.data.value?.last_event_at" />
          </p>
          <div v-else class="flex flex-wrap items-center gap-2">
            <Input
              v-model="project"
              class="w-72 font-mono"
              placeholder="group/project (optional)"
              aria-label="GitLab project"
            />
            <Button :disabled="connect.isPending.value" @click="runConnect">
              <Spinner v-if="connect.isPending.value" />
              Connect
            </Button>
          </div>

          <Alert v-if="token" class="border-warning/40">
            <TriangleAlert />
            <AlertTitle>Copy the secret token now</AlertTitle>
            <AlertDescription>It is shown once. The server keeps only its hash.</AlertDescription>
          </Alert>

          <GitlabSetupSteps :webhook-url="webhookUrl" :token="token" />
          <ErrorNotice v-if="connect.error.value" :error="connect.error.value" />
        </div>

        <template v-if="configured" #footer>
          <Button variant="outline" @click="confirmRotate = true">Rotate secret</Button>
          <Button variant="destructive" @click="confirmDisconnect = true">Disconnect</Button>
        </template>
      </SettingsSection>
    </template>

    <ConfirmDialog
      v-model:open="confirmRotate"
      title="Rotate the webhook secret"
      description="The current token stops working at once; paste the new one into GitLab."
      confirm-label="Rotate"
      :pending="connect.isPending.value"
      :error="connect.error.value"
      @confirm="runConnect"
    />
    <ConfirmDialog
      v-model:open="confirmDisconnect"
      title="Disconnect GitLab"
      description="Webhook calls are refused from now on. Builds already recorded stay."
      confirm-label="Disconnect"
      destructive
      :pending="disconnect.isPending.value"
      :error="disconnect.error.value"
      @confirm="runDisconnect"
    />
  </template>
</template>
