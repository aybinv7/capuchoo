<script setup lang="ts">
import { BadgeCheck, ShieldAlert } from "@lucide/vue";
import { computed } from "vue";
import { DataTable, type DataTableFacet } from "@/shared/components/data-table";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import VersionTag from "@/shared/components/VersionTag.vue";
import type { ArtefactKind } from "@/shared/delivery/lib/eligibility";
import { formatBytes } from "@/shared/lib/format";
import type { Artefact, Channel, ReleaseCatalog } from "@/shared/types/release";
import { releaseColumns, servingIndex } from "../lib/release-columns";
import ReleaseRowActions from "./ReleaseRowActions.vue";
import ServedByChips from "./ServedByChips.vue";

const search = defineModel<string>("search", { default: "" });

const props = defineProps<{
  kind: ArtefactKind;
  items: readonly Artefact[];
  catalog: ReleaseCatalog;
  loading: boolean;
  refreshing: boolean;
  appName: string;
}>();
const emit = defineEmits<{
  deliver: [artefact: Artefact, channel: Channel];
  edit: [artefact: Artefact];
  download: [artefact: Artefact];
  delete: [artefact: Artefact];
  refresh: [];
}>();

const FACETS: DataTableFacet[] = [
  { columnId: "flavour", title: "Flavour" },
  { columnId: "platform", title: "Platform" },
  { columnId: "signed", title: "Signing" },
  { columnId: "required", title: "Required" },
];

const serving = computed(() => servingIndex(props.catalog.channels));
const columns = computed(() => releaseColumns(props.kind, serving.value));
const servingOf = (artefact: Artefact) => serving.value.get(artefact.id) ?? [];
</script>

<template>
  <DataTable
    v-model:search="search"
    :key="props.kind"
    :data="props.items"
    :columns="columns"
    :get-row-id="(artefact) => artefact.id"
    :table-id="`releases-${props.kind}`"
    :export-name="`${props.appName}-${props.kind === 'ota' ? 'bundles' : 'native-builds'}`"
    :facets="FACETS"
    :features="{ selection: true, grouping: true }"
    search-placeholder="Version, build number, notes, uploader"
    :loading="props.loading"
    refreshable
    :refreshing="props.refreshing"
    @refresh="emit('refresh')"
  >
    <template #toolbar>
      <slot name="toolbar" />
    </template>
    <template #cell-version="{ row }">
      <div class="flex min-w-0 items-center gap-2">
        <VersionTag :kind="row.kind" :version="row.version_name" class="text-sm" />
        <span
          v-if="row.required"
          class="bg-warning-soft text-warning rounded px-1 text-[10px] font-semibold uppercase"
          >required</span
        >
      </div>
    </template>
    <template #cell-version_code="{ row }">
      <span class="font-mono text-xs tabular">{{
        row.kind === "native" ? row.version_code : "—"
      }}</span>
    </template>
    <template #cell-flavour="{ row }">
      <EnvBadge :environment="row.flavour" size="sm" />
    </template>
    <template #cell-platform="{ row }">
      <span class="text-muted-foreground font-mono text-xs uppercase">{{ row.platform }}</span>
    </template>
    <template #cell-size="{ row }">
      <span class="font-mono text-xs tabular">{{ formatBytes(row.size_bytes) }}</span>
    </template>
    <template #cell-signed="{ row }">
      <BadgeCheck v-if="row.signed" class="text-success size-4" aria-label="Signed" />
      <ShieldAlert v-else class="text-muted-foreground size-4" aria-label="Unsigned" />
    </template>
    <template #cell-required="{ row }">
      <span class="text-xs">{{ row.required ? "Required" : "Optional" }}</span>
    </template>
    <template #cell-served="{ row }">
      <ServedByChips :channels="servingOf(row)" />
    </template>
    <template #cell-uploaded="{ row }">
      <span class="text-muted-foreground text-xs"><RelativeTime :value="row.created_at" /></span>
    </template>
    <template #cell-uploaded_by="{ row }">
      <span class="text-muted-foreground text-xs">{{ row.uploaded_by ?? "—" }}</span>
    </template>
    <template #cell-actions="{ row }">
      <ReleaseRowActions
        :artefact="row"
        :catalog="props.catalog"
        :served="servingOf(row).length > 0"
        @deliver="emit('deliver', row, $event)"
        @edit="emit('edit', row)"
        @download="emit('download', row)"
        @delete="emit('delete', row)"
      />
    </template>
  </DataTable>
</template>
