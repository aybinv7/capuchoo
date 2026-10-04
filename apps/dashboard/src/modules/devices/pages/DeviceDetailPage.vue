<script setup lang="ts">
import { SmartphoneNfc } from "@lucide/vue";
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/shared/api/errors";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useBreadcrumbLabel } from "@/shared/layouts/composables/useBreadcrumbLabel";
import { usePeriod } from "@/shared/period/composables/usePeriod";
import { useCatalog } from "@/shared/queries/useCatalog";
import { RouteName } from "@/shared/router/route-names";
import AssignChannelDialog from "../components/AssignChannelDialog.vue";
import DeviceActivityPanel from "../components/DeviceActivityPanel.vue";
import DeviceHardwareCard from "../components/DeviceHardwareCard.vue";
import DeviceHero from "../components/DeviceHero.vue";
import DeviceLocationCard from "../components/DeviceLocationCard.vue";
import DeviceReleaseLane from "../components/DeviceReleaseLane.vue";
import DeviceSessionsCard from "../components/DeviceSessionsCard.vue";
import DeviceTimelineCard from "../components/DeviceTimelineCard.vue";
import RemoveDeviceDialog from "../components/RemoveDeviceDialog.vue";
import { useDeviceDetail } from "../composables/useDeviceDetail";
import { useDeviceMutations } from "../composables/useDeviceMutations";
import { deviceTitle } from "@/shared/devices/lib/device-title";

const route = useRoute();
const router = useRouter();
const { appId } = useCurrentApp();

const deviceId = computed(() =>
  typeof route.params.deviceId === "string" ? route.params.deviceId : "",
);
const detail = useDeviceDetail(appId, deviceId);
const device = computed(() => detail.data.value ?? null);
const missing = computed(() => isApiError(detail.error.value) && detail.error.value.status === 404);
const title = computed(() => (device.value ? deviceTitle(device.value) : null));
useBreadcrumbLabel(title);

const catalogQuery = useCatalog(appId);
const { catalog, channels } = catalogQuery;
const channel = computed(() => {
  const id = device.value?.channel?.id ?? device.value?.channel_id;
  return id ? (channels.value.find((entry) => entry.id === id) ?? null) : null;
});

const period = usePeriod(() => device.value?.retention_days);

const mutations = useDeviceMutations(appId);
const assignOpen = ref(false);
const removeOpen = ref(false);

function removed() {
  void router.replace({ name: RouteName.devices });
}
</script>

<template>
  <PageContainer width="wide">
    <EmptyState
      v-if="missing && !device"
      :icon="SmartphoneNfc"
      title="This device is not here"
      description="It was removed, or it belongs to an app you cannot see. A removed device registers again on its next update check."
    >
      <RouterLink
        :to="{ name: RouteName.devices }"
        class="text-primary text-sm underline-offset-4 hover:underline"
        >Back to devices</RouterLink
      >
    </EmptyState>
    <ErrorNotice
      v-else-if="detail.error.value && !device"
      :error="detail.error.value"
      :retry="detail.refetch"
    />
    <div v-else-if="!device || !title" class="space-y-6" aria-busy="true">
      <div class="flex items-start gap-4 border-b pb-5">
        <Skeleton class="size-11 rounded-xl" />
        <div class="flex-1 space-y-2">
          <Skeleton class="h-6 w-64" />
          <Skeleton class="h-4 w-96 max-w-full" />
          <Skeleton class="h-6 w-80 max-w-full" />
        </div>
      </div>
      <Skeleton class="h-16 w-full" />
      <Skeleton class="h-56 w-full" />
    </div>
    <template v-else>
      <DeviceHero
        :device="device"
        :title="title"
        @assign="assignOpen = true"
        @remove="removeOpen = true"
      />

      <DeviceReleaseLane
        :device="device"
        :channel="channel"
        :catalog="catalog"
        :pending="catalogQuery.isPending.value"
      />

      <DeviceActivityPanel
        :app-id="appId"
        :device-id="deviceId"
        :summary="device.summary"
        :period="period.period.value"
        :resolved="period.resolved.value"
        :now="period.now.value"
        :retention-days="period.retention.value"
        @change="period.setPeriod"
      />

      <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DeviceTimelineCard :app-id="appId" :device-id="deviceId" :bounds="period.bounds.value" />
        <div class="min-w-0 space-y-6">
          <DeviceSessionsCard :app-id="appId" :device-id="deviceId" :device-name="title" />
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
