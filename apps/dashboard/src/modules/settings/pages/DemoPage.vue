<script setup lang="ts">
import { CircleDashed, CircleOff, Presentation } from "@lucide/vue";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { isApiError } from "@/shared/api/errors";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { notifyError } from "@/shared/lib/notify";
import { RouteName } from "@/shared/router/route-names";
import DemoContents from "../components/demo/DemoContents.vue";
import DemoResult from "../components/demo/DemoResult.vue";
import SettingsSection from "../components/SettingsSection.vue";
import { useDemo } from "../composables/useDemo";
import type { DemoSeed } from "../types/settings.types";

const router = useRouter();
const { status, seed } = useDemo();
const confirmReset = ref(false);

const demo = computed(() => status.data.value ?? null);
const existing = computed(() => demo.value?.organization ?? null);
const refusedAsDisabled = computed(
  () => isApiError(seed.error.value) && seed.error.value.reason === "demo_disabled",
);
const disabled = computed(() => demo.value?.enabled === false || refusedAsDisabled.value);

function summary(result: DemoSeed): string {
  const runs = result.apps.reduce((sum, app) => sum + app.runs, 0);
  const devices = result.apps.reduce((sum, app) => sum + app.devices, 0);
  const names = result.apps.map((app) => app.name).join(" and ");
  return `${names}: ${devices} devices and ${runs} pipeline runs.`;
}

function run() {
  seed.mutate(undefined, {
    onSuccess: (result) => {
      confirmReset.value = false;
      const first = result.apps[0];
      toast.success(`${result.organization} is ready`, {
        description: summary(result),
        action: first
          ? {
              label: `Open ${first.name}`,
              onClick: () =>
                void router.push({ name: RouteName.canvas, params: { appId: first.id } }),
            }
          : undefined,
      });
    },
    onError: (error) => {
      if (isApiError(error) && error.reason === "demo_disabled") {
        confirmReset.value = false;
        void status.refetch();
        return;
      }
      if (!confirmReset.value) notifyError(error);
    },
  });
}

function start() {
  if (existing.value) confirmReset.value = true;
  else run();
}
</script>

<template>
  <PageContainer width="narrow">
    <PageHeader
      title="Demo"
      description="A fictional organization to present Capuchoo with, without touching a real app or repository."
    />

    <ErrorNotice v-if="status.error.value" :error="status.error.value" :retry="status.refetch" />
    <Skeleton v-else-if="status.isPending.value || !demo" class="h-64 w-full" />

    <SettingsSection
      v-else-if="disabled"
      title="Demo seeding is off on this server"
      description="The server only builds the demo organization when its operator allows it, so a production instance cannot be filled with sample data by accident."
    >
      <template #actions>
        <span class="text-muted-foreground flex items-center gap-1.5 text-sm">
          <CircleOff class="size-4" />
          Disabled
        </span>
      </template>
      <p class="text-sm">
        Set <code class="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">DEMO_SEED=enabled</code>
        in the server's environment and restart it, then come back to this page.
      </p>
    </SettingsSection>

    <template v-else>
      <SettingsSection title="Northwind Distribution">
        <template #actions>
          <span v-if="existing" class="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Presentation class="size-4" />
            Created <RelativeTime :value="existing.created_at" />
          </span>
          <span v-else class="text-muted-foreground flex items-center gap-1.5 text-sm">
            <CircleDashed class="size-4" />
            Not created
          </span>
        </template>
        <DemoContents />
        <template #footer>
          <p
            v-if="seed.isPending.value"
            class="text-muted-foreground mr-auto text-xs"
            role="status"
          >
            Building the organization; this takes up to half a minute.
          </p>
          <Button :disabled="seed.isPending.value" @click="start">
            <Spinner v-if="seed.isPending.value && !confirmReset" />
            {{ existing ? "Reset demo organization" : "Create demo organization" }}
          </Button>
        </template>
      </SettingsSection>

      <DemoResult v-if="seed.data.value" :result="seed.data.value" />
    </template>

    <ConfirmDialog
      v-model:open="confirmReset"
      title="Reset the demo organization"
      :description="`${existing?.name ?? 'The demo organization'} and everything in it is deleted and built again from scratch. Anyone looking at it loses what they were viewing.`"
      confirm-label="Reset"
      destructive
      :pending="seed.isPending.value"
      :error="seed.error.value"
      @confirm="run"
    />
  </PageContainer>
</template>
