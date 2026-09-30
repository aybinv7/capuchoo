<script setup lang="ts">
import { Package } from "@lucide/vue";
import { computed, ref } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
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
import ReleaseFiltersBar from "../components/ReleaseFiltersBar.vue";
import ReleaseTable from "../components/ReleaseTable.vue";
import { useReleaseMutations } from "../composables/useReleaseMutations";
import { filterReleases } from "../lib/filter-releases";
import type { ReleaseFilters } from "../types/releases.types";

const { appId } = useCurrentApp();
const { catalog, bundles, natives, isPending, error, refetch } = useCatalog(appId);
const mutations = useReleaseMutations(appId);
const dialogs = useDeliveryDialogs();

const kind = ref<ArtefactKind>("ota");
const filters = ref<ReleaseFilters>({ search: "", flavour: "all", platform: "all" });
const items = computed(() =>
  filterReleases(artefactsOfKind(catalog.value, kind.value), filters.value),
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
    />

    <div class="flex flex-wrap items-center justify-between gap-3">
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
      <ReleaseFiltersBar v-model="filters" />
    </div>

    <ErrorNotice v-if="error" :error="error" :retry="refetch" />
    <div v-else-if="isPending" class="space-y-2">
      <Skeleton v-for="index in 6" :key="index" class="h-12 w-full" />
    </div>
    <EmptyState
      v-else-if="items.length === 0"
      :icon="Package"
      :title="
        (kind === 'ota' ? bundles : natives).length
          ? 'No release matches the filters'
          : 'Nothing uploaded yet'
      "
      description="Releases appear here when capuchoo deploy uploads them."
    />
    <ReleaseTable
      v-else
      :items="items"
      :catalog="catalog"
      @deliver="deliver"
      @edit="edit"
      @download="mutations.download.mutate"
      @delete="askDelete"
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
