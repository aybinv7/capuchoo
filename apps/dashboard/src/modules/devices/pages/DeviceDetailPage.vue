<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRightLeft,
  Bug,
  History,
  MonitorSmartphone,
  SmartphoneNfc,
  Trash2,
} from "@lucide/vue";
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { isApiError } from "@/shared/api/errors";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import GateButton from "@/shared/components/GateButton.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useQueryParam } from "@/shared/composables/useQueryParam";
import { useCatalog } from "@/shared/queries/useCatalog";
import { RouteName } from "@/shared/router/route-names";
import AssignChannelDialog from "../components/AssignChannelDialog.vue";
import DeviceAttributesCard from "../components/DeviceAttributesCard.vue";
import DeviceFacts from "../components/DeviceFacts.vue";
import DeviceHardwareCard from "../components/DeviceHardwareCard.vue";
import DeviceLocationCard from "../components/DeviceLocationCard.vue";
import DevicePresence from "../components/DevicePresence.vue";
import DeviceSummaryTiles from "../components/DeviceSummaryTiles.vue";
import DeviceVersionsCard from "../components/DeviceVersionsCard.vue";
import EventFilterChips from "../components/EventFilterChips.vue";
import EventTimeline from "../components/EventTimeline.vue";
import RemoveDeviceDialog from "../components/RemoveDeviceDialog.vue";
import { useDeviceDetail } from "../composables/useDeviceDetail";
import { useDeviceEvents } from "../composables/useDeviceEvents";
import { useDeviceMutations } from "../composables/useDeviceMutations";
import { deviceTitle } from "../lib/device-columns";
import { EVENT_FILTERS, isEventFilter } from "../lib/event-filters";
import type { EventFilter } from "../types/devices.types";

const route = useRoute();
const router = useRouter();
const { appId } = useCurrentApp();
const permissions = useAppPermissions();

const deviceId = computed(() =>
  typeof route.params.deviceId === "string" ? route.params.deviceId : "",
);
const detail = useDeviceDetail(appId, deviceId);
const device = computed(() => detail.data.value ?? null);
const missing = computed(() => isApiError(detail.error.value) && detail.error.value.status === 404);

const { catalog, channels } = useCatalog(appId);
const channel = computed(() => {
  const id = device.value?.channel?.id ?? device.value?.channel_id;
  return id ? (channels.value.find((entry) => entry.id === id) ?? null) : null;
});

const filter = useQueryParam<EventFilter>("events", "all", isEventFilter);
const feed = useDeviceEvents(appId, deviceId, filter);
const filterLabel = computed(
  () => EVENT_FILTERS.find((option) => option.value === filter.value)?.label.toLowerCase() ?? "",
);

const mutations = useDeviceMutations(appId);
const assignGate = computed(() => permissions.assignDevice(null));
const removeGate = computed(() => permissions.removeDevice.value);
const assignOpen = ref(false);
const removeOpen = ref(false);

function removed() {
  void router.replace({ name: RouteName.devices });
}
</script>

<template>
  <PageContainer width="wide">
    <RouterLink
      :to="{ name: RouteName.devices }"
      class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft class="size-3.5" />
      Devices
    </RouterLink>

    <EmptyState
      v-if="missing && !device"
      :icon="SmartphoneNfc"
      title="This device is not here"
      description="It was removed, or it belongs to an app you cannot see. A removed device registers again on its next update check."
    />
    <ErrorNotice
      v-else-if="detail.error.value && !device"
      :error="detail.error.value"
      :retry="detail.refetch"
    />
    <div v-else-if="!device" class="space-y-6" aria-busy="true">
      <Skeleton class="h-14 w-80" />
      <Skeleton class="h-10 w-full" />
      <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Skeleton class="h-48" />
        <Skeleton class="h-48" />
      </div>
    </div>
    <template v-else>
      <PageHeader :title="deviceTitle(device)">
        <template #eyebrow>
          <span class="font-mono uppercase">{{ device.platform }}</span>
          <span v-if="device.version_os">{{ device.version_os }}</span>
          <span v-if="device.is_emulator" class="inline-flex items-center gap-1">
            <MonitorSmartphone class="size-3.5" />
            Emulator
          </span>
          <span v-if="device.is_prod === false" class="text-warning inline-flex items-center gap-1">
            <Bug class="size-3.5" />
            Debug build
          </span>
        </template>
        <template #badges>
          <DevicePresence :last-seen-at="device.last_seen_at" />
        </template>
        <template #actions>
          <GateButton variant="outline" size="sm" :gate="assignGate" @click="assignOpen = true">
            <ArrowRightLeft />
            Assign channel
          </GateButton>
          <GateButton variant="outline" size="sm" :gate="removeGate" @click="removeOpen = true">
            <Trash2 />
            Remove
          </GateButton>
        </template>
      </PageHeader>

      <DeviceFacts :device="device" />

      <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DeviceAttributesCard
          :attributes="device.attributes"
          :updated-at="device.attributes_updated_at"
        />
        <DeviceVersionsCard :device="device" :channel="channel" :catalog="catalog" />
      </div>

      <DeviceSummaryTiles :summary="device.summary" />

      <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section class="bg-card min-w-0 rounded-lg border">
          <header
            class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2.5"
          >
            <span
              class="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase"
            >
              <History class="size-3.5" />
              Timeline
              <Spinner
                v-if="feed.isFetching.value && !feed.isPending.value"
                class="size-3"
                aria-label="Refreshing"
              />
            </span>
            <EventFilterChips v-model="filter" />
          </header>
          <div class="p-4">
            <ErrorNotice v-if="feed.error.value" :error="feed.error.value" :retry="feed.refetch" />
            <div v-else-if="feed.isPending.value" class="space-y-3" aria-busy="true">
              <Skeleton v-for="index in 6" :key="index" class="h-9 w-full" />
            </div>
            <p
              v-else-if="feed.events.value.length === 0"
              class="text-muted-foreground py-6 text-center text-sm text-pretty"
            >
              {{
                filter === "all"
                  ? "No event in the kept history. Events appear as the app checks for and installs updates."
                  : `No ${filterLabel} event in the kept history.`
              }}
            </p>
            <EventTimeline
              v-else
              :events="feed.events.value"
              :has-more="feed.hasMore.value"
              :loading-older="feed.loadingOlder.value"
              :older-error="feed.olderError.value"
              :collapse-checks="filter !== 'check'"
              @load-older="feed.loadOlder"
              @retry-older="feed.retryOlder"
            />
          </div>
        </section>
        <div class="min-w-0 space-y-6">
          <DeviceLocationCard
            :latitude="device.latitude"
            :longitude="device.longitude"
            :accuracy="device.location_accuracy_m"
            :reported-at="device.location_reported_at"
          />
          <DeviceHardwareCard :device="device" />
        </div>
      </div>

      <AssignChannelDialog
        v-model:open="assignOpen"
        :device="device"
        :channels="channels"
        :assign="mutations.assign"
      />
      <RemoveDeviceDialog
        v-model:open="removeOpen"
        :device="device"
        :remove="mutations.remove"
        @removed="removed"
      />
    </template>
  </PageContainer>
</template>
