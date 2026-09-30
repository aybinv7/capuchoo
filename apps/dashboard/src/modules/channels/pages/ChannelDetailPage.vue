<script setup lang="ts">
import { ArrowLeft, CirclePause, CirclePlay, History, Rocket } from "@lucide/vue";
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ChannelStatusBadges from "@/shared/components/ChannelStatusBadges.vue";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import GateButton from "@/shared/components/GateButton.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import DeliveryDialogHost from "@/shared/delivery/components/DeliveryDialogHost.vue";
import { useDeliveryDialogs } from "@/shared/delivery/composables/useDeliveryDialogs";
import { findArtefact } from "@/shared/delivery/lib/eligibility";
import { useCatalog } from "@/shared/queries/useCatalog";
import { useChannelDetail, useChannelHistory } from "@/shared/queries/useChannelQueries";
import { RouteName } from "@/shared/router/route-names";
import ChannelActionsMenu from "../components/ChannelActionsMenu.vue";
import ChannelHealthCard from "../components/ChannelHealthCard.vue";
import ChannelHistoryTimeline from "../components/ChannelHistoryTimeline.vue";
import ChannelSettingsCard from "../components/ChannelSettingsCard.vue";
import CurrentArtefactCard from "../components/CurrentArtefactCard.vue";
import DeleteChannelDialog from "../components/DeleteChannelDialog.vue";

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
const { catalog, channels } = useCatalog(appId);

const channel = computed(
  () => channels.value.find((entry) => entry.id === channelId.value) ?? detail.data.value ?? null,
);
const bundle = computed(() => {
  const id = channel.value?.current_bundle_id;
  if (!id) return null;
  const found = findArtefact(catalog.value, id);
  return found?.kind === "ota" ? found : (detail.data.value?.current_bundle ?? null);
});
const native = computed(() => {
  const id = channel.value?.current_native_id;
  if (!id) return null;
  const found = findArtefact(catalog.value, id);
  return found?.kind === "native" ? found : (detail.data.value?.current_native ?? null);
});
const deliverGate = computed(() =>
  channel.value ? permissions.deliver(channel.value.environment) : { ok: true as const },
);

const deleteOpen = ref(false);
</script>

<template>
  <PageContainer width="wide">
    <RouterLink
      :to="{ name: RouteName.channels }"
      class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft class="size-3.5" />
      Channels
    </RouterLink>

    <ErrorNotice
      v-if="detail.error.value && !channel"
      :error="detail.error.value"
      :retry="detail.refetch"
    />
    <div v-else-if="!channel" class="space-y-4">
      <Skeleton class="h-10 w-72" />
      <Skeleton class="h-48 w-full" />
    </div>
    <template v-else>
      <PageHeader :title="channel.name">
        <template #badges>
          <EnvBadge :environment="channel.environment" />
          <ChannelStatusBadges :channel="channel" />
        </template>
        <template #actions>
          <GateButton :gate="deliverGate" @click="dialogs.deliver(channel)">
            <Rocket />
            Deliver
          </GateButton>
          <GateButton variant="outline" :gate="deliverGate" @click="dialogs.rollback(channel)">
            <History />
            Roll back
          </GateButton>
          <GateButton variant="outline" :gate="deliverGate" @click="dialogs.togglePause(channel)">
            <CirclePlay v-if="channel.paused" />
            <CirclePause v-else />
            {{ channel.paused ? "Resume" : "Pause" }}
          </GateButton>
          <ChannelActionsMenu :channel="channel" :dialogs="dialogs" @delete="deleteOpen = true" />
        </template>
      </PageHeader>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div class="min-w-0 space-y-6">
          <div class="grid gap-4 md:grid-cols-2">
            <CurrentArtefactCard kind="ota" :artefact="bundle" />
            <CurrentArtefactCard kind="native" :artefact="native" />
          </div>
          <section class="bg-card rounded-lg border">
            <header class="flex items-center justify-between border-b px-4 py-2.5">
              <span class="text-muted-foreground text-xs font-medium uppercase">History</span>
              <span class="text-muted-foreground text-xs">newest first</span>
            </header>
            <div class="p-4">
              <ErrorNotice
                v-if="history.error.value"
                :error="history.error.value"
                :retry="history.refetch"
              />
              <div v-else-if="history.isPending.value" class="space-y-3">
                <Skeleton v-for="index in 3" :key="index" class="h-10 w-full" />
              </div>
              <p v-else-if="!history.data.value?.length" class="text-muted-foreground text-sm">
                Nothing has been delivered on this channel yet.
              </p>
              <ChannelHistoryTimeline v-else :entries="history.data.value" />
            </div>
          </section>
        </div>
        <div class="min-w-0 space-y-6">
          <ChannelHealthCard :health="detail.data.value?.health ?? null" />
          <ChannelSettingsCard
            :channel="channel"
            :channels="channels"
            :history="history.data.value ?? []"
          />
        </div>
      </div>

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
