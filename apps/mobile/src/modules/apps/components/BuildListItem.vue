<template>
  <F7ListItem :link="href" @click="tick">
    <template #media>
      <span
        class="grid size-10 place-items-center rounded-full"
        :class="
          installed
            ? 'bg-primary-container text-primary-container-foreground'
            : 'bg-muted text-muted-foreground'
        "
      >
        <F7Icon :md="installed ? 'material:phone_android' : 'material:android'" size="20" />
      </span>
    </template>
    <template #title>
      <span class="cap-mono font-semibold">{{ build.version_name }}</span>
    </template>
    <template #after>
      <span class="text-xs tabular-nums">{{ formatRelative(build.created_at, locale) }}</span>
    </template>
    <template #subtitle>
      <span class="cap-mono text-xs"
        >#{{ build.version_code }} · {{ formatBytes(build.size_bytes) }}</span
      >
      <span v-if="installed" class="ms-2 text-xs font-semibold text-primary">{{
        t("build.onThisPhone")
      }}</span>
    </template>
    <template v-if="chips.length || build.release_notes" #text>
      <span class="flex flex-col gap-1">
        <span v-if="chips.length" class="flex flex-wrap gap-1">
          <EnvironmentChip v-if="build.flavour" :environment="build.flavour" />
          <F7Chip v-for="channel in served" :key="channel" :text="channel" class="build-chip" />
          <F7Chip
            v-if="build.required"
            :text="t('build.required')"
            class="build-chip build-chip-required"
          />
        </span>
        <span v-if="build.release_notes" class="line-clamp-2">{{ build.release_notes }}</span>
      </span>
    </template>
  </F7ListItem>
</template>

<script setup lang="ts">
import type { NativeBuild } from "@/domains/catalog/catalog.repository";
import EnvironmentChip from "@/shared/components/app/EnvironmentChip.vue";
import { formatBytes, formatRelative, parseChannels } from "@/shared/utils/format";
import { tick } from "@/shared/utils/native/haptics";

const props = defineProps<{ build: NativeBuild; href: string; installed: boolean }>();
const { t, locale } = useI18n();
/** A channel named after the build's own flavour says nothing the flavour chip did not. */
const served = computed(() =>
  parseChannels(props.build.channels).filter((channel) => channel !== props.build.flavour),
);
const chips = computed(() => [
  ...(props.build.flavour ? [props.build.flavour] : []),
  ...served.value,
  ...(props.build.required ? ["required"] : []),
]);
</script>

<style scoped>
.build-chip {
  --f7-chip-height: 22px;
  --f7-chip-font-size: 11px;
  --f7-chip-border-radius: 6px;
}

.build-chip-required {
  --f7-chip-bg-color: var(--destructive-container);
  --f7-chip-text-color: var(--destructive-container-foreground);
}
</style>
