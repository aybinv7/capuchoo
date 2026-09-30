<script setup lang="ts">
import { Package } from "@lucide/vue";
import { computed, ref } from "vue";
import { useQueryParam } from "@/shared/composables/useQueryParam";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import DeliveryDialogHost from "@/shared/delivery/components/DeliveryDialogHost.vue";
import { useDeliveryDialogs } from "@/shared/delivery/composables/useDeliveryDialogs";
import { artefactsOfKind, type ArtefactKind } from "@/shared/delivery/lib/eligibility";
import { useCatalog } from "@/shared/queries/useCatalog";
import type { Artefact, Channel } from "@/shared/types/release";
import DeleteReleaseDialog from "../components/DeleteReleaseDialog.vue";
import EditReleaseSheet from "../components/EditReleaseSheet.vue";
import ReleaseTable from "../components/ReleaseTable.vue";
import { useReleaseMutations } from "../composables/useReleaseMutations";

const { appId, app } = useCurrentApp();
const { catalog, bundles, natives, isPending, isFetching, error, refetch } = useCatalog(appId);
const mutations = useReleaseMutations(appId);
const dialogs = useDeliveryDialogs();

const isKind = (value: string): value is ArtefactKind => value === "ota" || value === "native";
const kind = useQueryParam<ArtefactKind>("kind", "ota", isKind);
const search = useQueryParam("q", "");
const items = computed(() => artefactsOfKind(catalog.value, kind.value));
const nothingUploaded = computed(
  () => !isPending.value && bundles.value.length === 0 && natives.value.length === 0,
);

const editing = ref<Artefact | null>(null);
const editOpen = ref(false);
const deleting = ref<Artefact | null>(null);
const deleteOpen = ref(false);

function setKind(value: string | number) {
  if (value === "ota" || value === "native") kind.value = value;
}

function edit(artefact: Artefact) {
  editing.value = artefact;
  editOpen.value = true;
}

function askDelete(artefact: Artefact) {
  deleting.value = artefact;
  deleteOpen.value = true;
}

function deliver(artefact: Artefact, channel: Channel) {
  dialogs.deliver(channel, artefact.id);
}
</script>

<template>
  <PageContainer width="wide">
    <PageHeader
      title="Releases"
      description="Every uploaded OTA bundle and native build, and the channels serving each one."
    >
      <template #actions>
        <Tabs :model-value="kind" @update:model-value="setKind">
          <TabsList>
            <TabsTrigger value="ota">
              OTA bundles
              <span class="text-muted-foreground ml-1 font-mono text-xs">{{ bundles.length }}</span>
            </TabsTrigger>
            <TabsTrigger value="native">
              Native builds
              <span class="text-muted-foreground ml-1 font-mono text-xs">{{ natives.length }}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </template>
    </PageHeader>

    <ErrorNotice v-if="error" :error="error" :retry="refetch" />
    <EmptyState
      v-else-if="nothingUploaded"
      :icon="Package"
      title="Nothing uploaded yet"
      description="Releases appear here when capuchoo deploy uploads them."
    />
    <ReleaseTable
      v-else
      v-model:search="search"
      :kind="kind"
      :items="items"
      :catalog="catalog"
      :loading="isPending"
      :refreshing="isFetching && !isPending"
      :app-name="app?.name ?? 'releases'"
      @deliver="deliver"
      @edit="edit"
      @download="mutations.download.mutate"
      @delete="askDelete"
      @refresh="refetch"
    />

    <EditReleaseSheet v-model:open="editOpen" :artefact="editing" :update="mutations.update" />
    <DeleteReleaseDialog
      v-model:open="deleteOpen"
      :artefact="deleting"
      :channels="catalog.channels"
      :remove="mutations.remove"
    />
    <DeliveryDialogHost :controller="dialogs" />
  </PageContainer>
</template>
