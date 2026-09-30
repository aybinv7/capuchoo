<script setup lang="ts">
import { BadgeCheck, ShieldAlert } from "@lucide/vue";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import VersionTag from "@/shared/components/VersionTag.vue";
import VirtualRows from "@/shared/components/VirtualRows.vue";
import { channelsServing } from "@/shared/delivery/lib/eligibility";
import { formatBytes } from "@/shared/lib/format";
import type { Artefact, Channel, ReleaseCatalog } from "@/shared/types/release";
import ReleaseRowActions from "./ReleaseRowActions.vue";
import ServedByChips from "./ServedByChips.vue";

const props = defineProps<{ items: readonly Artefact[]; catalog: ReleaseCatalog }>();
const emit = defineEmits<{
  deliver: [artefact: Artefact, channel: Channel];
  edit: [artefact: Artefact];
  download: [artefact: Artefact];
  delete: [artefact: Artefact];
}>();

const COLUMNS =
  "minmax(9rem,1.2fr) 5.5rem 4.5rem 5rem 4rem minmax(8rem,1.4fr) minmax(8rem,1fr) 2.5rem";

const servingOf = (artefact: Artefact) => channelsServing(artefact.id, props.catalog.channels);
</script>

<template>
  <VirtualRows
    :items="props.items"
    :row-height="52"
    :columns="COLUMNS"
    :item-key="(artefact) => artefact.id"
  >
    <template #header>
      <span>Version</span>
      <span>Flavour</span>
      <span>Platform</span>
      <span class="text-right">Size</span>
      <span>Signed</span>
      <span>Served by</span>
      <span>Uploaded</span>
      <span />
    </template>
    <template #row="{ item }">
      <div class="flex min-w-0 items-center gap-2">
        <VersionTag
          :kind="item.kind"
          :version="item.version_name"
          :code="item.kind === 'native' ? item.version_code : null"
          class="text-sm"
        />
        <span
          v-if="item.required"
          class="bg-warning-soft text-warning rounded px-1 text-[10px] font-semibold uppercase"
          >required</span
        >
      </div>
      <EnvBadge :environment="item.flavour" size="sm" />
      <span class="text-muted-foreground font-mono text-xs uppercase">{{ item.platform }}</span>
      <span class="text-right font-mono text-xs tabular">{{ formatBytes(item.size_bytes) }}</span>
      <span>
        <BadgeCheck v-if="item.signed" class="text-success size-4" aria-label="Signed" />
        <ShieldAlert v-else class="text-muted-foreground size-4" aria-label="Unsigned" />
      </span>
      <ServedByChips :channels="servingOf(item)" />
      <div class="text-muted-foreground min-w-0 truncate text-xs">
        <RelativeTime :value="item.created_at" />
        <span v-if="item.uploaded_by"> · {{ item.uploaded_by }}</span>
      </div>
      <ReleaseRowActions
        :artefact="item"
        :catalog="props.catalog"
        :served="servingOf(item).length > 0"
        @deliver="emit('deliver', item, $event)"
        @edit="emit('edit', item)"
        @download="emit('download', item)"
        @delete="emit('delete', item)"
      />
    </template>
  </VirtualRows>
</template>
