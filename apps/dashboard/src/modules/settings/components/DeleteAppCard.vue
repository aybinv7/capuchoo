<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import GateButton from "@/shared/components/GateButton.vue";
import type { Gate } from "@/shared/lib/gate";
import { RouteName } from "@/shared/router/route-names";
import type { AppSummary } from "@/shared/types/session";
import type { useAppGeneral } from "../composables/useAppGeneral";
import SettingsSection from "./SettingsSection.vue";

const props = defineProps<{
  app: AppSummary;
  gate: Gate;
  remove: ReturnType<typeof useAppGeneral>["remove"];
  refreshSession: () => Promise<unknown>;
}>();

const router = useRouter();
const open = ref(false);

function confirm() {
  props.remove.mutate(undefined, {
    onSuccess: async () => {
      open.value = false;
      toast.success(`${props.app.name} deleted`);
      await router.replace({ name: RouteName.apps });
      await props.refreshSession();
    },
  });
}
</script>

<template>
  <SettingsSection
    title="Delete this app"
    description="Removes every channel, release, device record and history entry of the app. Installed apps keep what they run and stop receiving updates."
  >
    <GateButton variant="destructive" :gate="props.gate" @click="open = true"
      >Delete app</GateButton
    >
    <ConfirmDialog
      v-model:open="open"
      :title="`Delete ${props.app.name}`"
      description="This cannot be undone."
      confirm-label="Delete app"
      destructive
      :require-text="props.app.app_id"
      :pending="props.remove.isPending.value"
      :error="props.remove.error.value"
      @confirm="confirm"
    />
  </SettingsSection>
</template>
