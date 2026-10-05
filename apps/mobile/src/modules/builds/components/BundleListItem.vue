<template>
  <F7ListItem class="build-item">
    <template #media>
      <span
        class="grid size-10 place-items-center rounded-full"
        :class="
          served.length ? 'bg-tertiary text-tertiary-foreground' : 'bg-muted text-muted-foreground'
        "
      >
        <F7Icon md="material:bolt" size="20" />
      </span>
    </template>
    <template #title>
      <span class="cap-mono font-semibold">{{ bundle.version_name }}</span>
    </template>
    <template #after>
      <span class="text-xs tabular-nums">{{ formatRelative(bundle.created_at, locale) }}</span>
    </template>
    <template #subtitle>
      <span class="cap-mono text-xs">{{ formatBytes(bundle.size_bytes) }}</span>
      <span v-if="bundle.min_native_version" class="cap-mono ms-2 text-xs">{{
        t("builds.minNative", { code: bundle.min_native_version })
      }}</span>
    </template>
    <template
      v-if="bundle.flavour || served.length || bundle.required || bundle.release_notes"
      #text
    >
      <span class="flex flex-col gap-1">
        <span
          v-if="bundle.flavour || served.length || bundle.required"
          class="flex flex-wrap gap-1"
        >
          <EnvironmentChip v-if="bundle.flavour" :environment="bundle.flavour" />
          <F7Chip v-for="channel in served" :key="channel" :text="channel" class="bundle-chip" />
          <F7Chip
            v-if="bundle.required"
            :text="t('build.required')"
            class="bundle-chip bundle-chip-required"
          />
        </span>
        <span v-if="bundle.release_notes" class="line-clamp-2">{{ bundle.release_notes }}</span>
      </span>
    </template>
  </F7ListItem>
</template>

<script setup lang="ts">
import type { Bundle } from "@/domains/catalog/catalog.repository";
import EnvironmentChip from "@/shared/components/app/EnvironmentChip.vue";
import { formatBytes, formatRelative, parseChannels } from "@/shared/utils/format";

/** An OTA bundle: the web layer a channel can serve over a native build without a reinstall. */
const props = defineProps<{ bundle: Bundle }>();
const { t, locale } = useI18n();

const served = computed(() =>
  parseChannels(props.bundle.channels).filter((channel) => channel !== props.bundle.flavour),
);
</script>

<style scoped>
/*
 * The text slot holds chips above the notes, taller than the two text lines a media list clamps it
 * to, so the clamp moves to the notes alone instead of cutting their last line in half.
 */
.build-item :deep(.item-text) {
  display: block;
  max-height: none;
  -webkit-line-clamp: unset;
  overflow: visible;
}

.bundle-chip {
  --f7-chip-height: 22px;
  --f7-chip-font-size: 11px;
  --f7-chip-border-radius: 6px;
}

.bundle-chip-required {
  --f7-chip-bg-color: var(--destructive-container);
  --f7-chip-text-color: var(--destructive-container-foreground);
}
</style>
