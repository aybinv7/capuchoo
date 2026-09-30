<script setup lang="ts">
import { Plus, RadioTower } from "@lucide/vue";
import { ref } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import GateButton from "@/shared/components/GateButton.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import DeliveryDialogHost from "@/shared/delivery/components/DeliveryDialogHost.vue";
import { useDeliveryDialogs } from "@/shared/delivery/composables/useDeliveryDialogs";
import { useAppStats } from "@/shared/queries/useAppStats";
import { useCatalog } from "@/shared/queries/useCatalog";
import type { Channel } from "@/shared/types/release";
import ChannelsTable from "../components/ChannelsTable.vue";
import CreateChannelDialog from "../components/CreateChannelDialog.vue";
import DeleteChannelDialog from "../components/DeleteChannelDialog.vue";

const { appId, app } = useCurrentApp();
const { catalog, channels, isPending, error, refetch } = useCatalog(appId);
const { byChannel } = useAppStats(appId);
const permissions = useAppPermissions();
const dialogs = useDeliveryDialogs();

const creating = ref(false);
const deleting = ref<Channel | null>(null);
const deleteOpen = ref(false);

function askDelete(channel: Channel) {
  deleting.value = channel;
  deleteOpen.value = true;
}
</script>

<template>
  <PageContainer width="wide">
    <PageHeader
      title="Channels"
      :description="`Where ${app?.name ?? 'the app'}'s devices get their releases. Pointers move only through Deliver, Roll back and Pause.`"
    >
      <template #actions>
        <GateButton :gate="permissions.manageChannels.value" @click="creating = true">
          <Plus />
          New channel
        </GateButton>
      </template>
    </PageHeader>

    <ErrorNotice v-if="error" :error="error" :retry="refetch" />
    <div v-else-if="isPending" class="space-y-2">
      <Skeleton v-for="index in 5" :key="index" class="h-11 w-full" />
    </div>
    <EmptyState
      v-else-if="channels.length === 0"
      :icon="RadioTower"
      title="No channels yet"
      description="The first capuchoo deploy creates dev, staging and prod. You can also create one here."
    />
    <ChannelsTable
      v-else
      :catalog="catalog"
      :health="byChannel"
      :dialogs="dialogs"
      @delete="askDelete"
    />

    <CreateChannelDialog v-model:open="creating" :app-id="appId" :channels="channels" />
    <DeleteChannelDialog v-model:open="deleteOpen" :channel="deleting" :channels="channels" />
    <DeliveryDialogHost :controller="dialogs" />
  </PageContainer>
</template>
