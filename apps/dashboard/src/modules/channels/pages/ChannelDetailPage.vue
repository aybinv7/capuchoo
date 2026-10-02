<script setup lang="ts">
import { RadioTower } from "@lucide/vue";
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/shared/api/errors";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import DeliveryDialogHost from "@/shared/delivery/components/DeliveryDialogHost.vue";
import { useDeliveryDialogs } from "@/shared/delivery/composables/useDeliveryDialogs";
import { findArtefact } from "@/shared/delivery/lib/eligibility";
import { useBreadcrumbLabel } from "@/shared/layouts/composables/useBreadcrumbLabel";
import { usePeriod } from "@/shared/period/composables/usePeriod";
import { useCatalog } from "@/shared/queries/useCatalog";
import { useChannelDetail, useChannelHistory } from "@/shared/queries/useChannelQueries";
import { RouteName } from "@/shared/router/route-names";
import type { Bundle, NativeBuild } from "@/shared/types/release";
import ChannelActivityPanel from "../components/ChannelActivityPanel.vue";
import ChannelHero from "../components/ChannelHero.vue";
import ChannelHistoryCard from "../components/ChannelHistoryCard.vue";
import ChannelRunsCard from "../components/ChannelRunsCard.vue";
import ChannelServingLane from "../components/ChannelServingLane.vue";
import ChannelSettingsSheet from "../components/ChannelSettingsSheet.vue";
import DeleteChannelDialog from "../components/DeleteChannelDialog.vue";
import ChannelRolloutPanel from "../components/rollout/ChannelRolloutPanel.vue";
import { useChannelRollout } from "../composables/useChannelRollout";
import { pauseReason, servingSince } from "../lib/channel-history";

const route = useRoute();
const router = useRouter();
const { appId } = useCurrentApp();
const permissions = useAppPermissions();
const dialogs = useDeliveryDialogs();

const channelId = computed(() =>
  typeof route.params.channelId === "string" ? route.params.channelId : "",
);
const detail = useChannelDetail(channelId);
const history = useChannelHistory(channelId);
const rollout = useChannelRollout(appId, channelId);
const catalogQuery = useCatalog(appId);
const { catalog, channels } = catalogQuery;
const period = usePeriod(null);

const channel = computed(
  () => channels.value.find((entry) => entry.id === channelId.value) ?? detail.data.value ?? null,
);
const missing = computed(() => isApiError(detail.error.value) && detail.error.value.status === 404);
useBreadcrumbLabel(() => channel.value?.name);

const base = computed(() => {
  const id = channel.value?.base_channel_id;
  return id ? (channels.value.find((entry) => entry.id === id) ?? null) : null;
});
const bundle = computed<Bundle | null>(() => {
  const id = channel.value?.current_bundle_id;
  if (!id) return null;
  const found = findArtefact(catalog.value, id);
  return found?.kind === "ota" ? found : (detail.data.value?.current_bundle ?? null);
});
const native = computed<NativeBuild | null>(() => {
  const id = channel.value?.current_native_id;
  if (!id) return null;
  const found = findArtefact(catalog.value, id);
  return found?.kind === "native" ? found : (detail.data.value?.current_native ?? null);
});
const resolving = computed(() => catalogQuery.isPending.value || detail.isPending.value);

const entries = computed(() => history.data.value ?? []);
const since = computed(() => {
  const id = channel.value?.current_bundle_id ?? null;
  const current = rollout.data.value?.current;
  if (current && current.bundle_id === id)
    return { at: current.delivered_at, by: current.delivered_by };
  const moved = servingSince(entries.value, id);
  return moved ? { at: moved.at, by: moved.by } : null;
});
const devices = computed(
  () => rollout.data.value?.devices ?? detail.data.value?.health?.devices ?? null,
);
const devicesPending = computed(
  () => devices.value === null && (rollout.isPending.value || detail.isPending.value),
);
const paused = computed(() => (channel.value?.paused ? pauseReason(entries.value) : null));
const deliverGate = computed(() =>
  channel.value ? permissions.deliver(channel.value.environment) : { ok: true as const },
);

const settingsOpen = ref(false);
const deleteOpen = ref(false);

function deliver(kind?: "ota" | "native") {
  if (channel.value) dialogs.deliver(channel.value, null, kind);
}
</script>

<template>
  <PageContainer width="wide">
    <EmptyState
      v-if="missing && !channel"
      :icon="RadioTower"
      title="This channel is not here"
      description="It was deleted, or it belongs to an app you cannot see."
    >
      <RouterLink
        :to="{ name: RouteName.channels }"
        class="text-primary text-sm underline-offset-4 hover:underline"
        >Back to channels</RouterLink
      >
    </EmptyState>
    <ErrorNotice
      v-else-if="detail.error.value && !channel"
      :error="detail.error.value"
      :retry="detail.refetch"
    />
    <div v-else-if="!channel" class="space-y-6" aria-busy="true">
      <div class="flex items-start gap-4 border-b pb-5">
        <Skeleton class="size-11 rounded-xl" />
        <div class="flex-1 space-y-2">
          <Skeleton class="h-6 w-56" />
          <Skeleton class="h-4 w-96 max-w-full" />
        </div>
      </div>
      <Skeleton class="h-16 w-full" />
      <Skeleton class="h-72 w-full" />
    </div>
    <template v-else>
      <ChannelHero
        :channel="channel"
        :base="base"
        :dialogs="dialogs"
        :version="bundle?.version_name ?? null"
        :since="since"
        :devices="devices"
        :devices-pending="devicesPending"
        :pause-reason="paused"
        @settings="settingsOpen = true"
        @delete="deleteOpen = true"
      />

      <ChannelServingLane
        :bundle="bundle"
        :native="native"
        :bundle-pending="Boolean(channel.current_bundle_id) && !bundle && resolving"
        :native-pending="Boolean(channel.current_native_id) && !native && resolving"
        :deliver-gate="deliverGate"
        @deliver="deliver"
      />

      <ChannelRolloutPanel
        :app-id="appId"
        :channel-id="channelId"
        :deliver-gate="deliverGate"
        @deliver="deliver"
      />

      <ChannelActivityPanel
        :app-id="appId"
        :channel-id="channelId"
        :history="entries"
        :period="period.period.value"
        :resolved="period.resolved.value"
        :now="period.now.value"
        @change="period.setPeriod"
      />

      <div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ChannelHistoryCard
          :entries="history.data.value"
          :pending="history.isPending.value"
          :error="history.error.value"
          :retry="history.refetch"
        />
        <ChannelRunsCard :app-id="appId" :channel-id="channelId" />
      </div>

      <ChannelSettingsSheet
        v-model:open="settingsOpen"
        :channel="channel"
        :channels="channels"
        :history="entries"
        :history-ready="history.isSuccess.value"
      />
      <DeleteChannelDialog
        v-model:open="deleteOpen"
        :channel="channel"
        :channels="channels"
        @deleted="router.replace({ name: RouteName.channels })"
      />
    </template>
    <DeliveryDialogHost :controller="dialogs" />
  </PageContainer>
</template>
