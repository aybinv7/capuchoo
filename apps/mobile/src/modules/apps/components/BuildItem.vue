<template>
  <a :href="href" class="build-item" :class="{ installed }" @click="tick">
    <div class="build-version">
      <span class="cap-mono text-base leading-5 font-semibold">{{ build.version_name }}</span>
      <span class="cap-mono text-xs text-muted-foreground">#{{ build.version_code }}</span>
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-1.5">
      <div class="flex flex-wrap items-center gap-1.5">
        <EnvironmentChip v-if="build.flavour" :environment="build.flavour" />
        <span v-for="channel in served" :key="channel" class="served-chip">{{ channel }}</span>
        <span v-if="build.required" class="served-chip required">{{ t("build.required") }}</span>
      </div>
      <p class="truncate text-xs text-muted-foreground">
        {{ formatBytes(build.size_bytes) }} · {{ formatRelative(build.created_at, locale) }}
        <template v-if="build.release_notes"> · {{ build.release_notes }}</template>
      </p>
    </div>
    <F7Icon v-if="installed" md="material:phone_android" size="20" class="shrink-0 text-primary" :aria-label="t('build.onThisPhone')" />
    <F7Icon v-else md="material:chevron_right" size="20" class="shrink-0 text-muted-foreground" />
  </a>
</template>

<script setup lang="ts">
import type { NativeBuild } from "@/domains/catalog/catalog.repository";
import EnvironmentChip from "@/shared/components/app/EnvironmentChip.vue";
import { formatBytes, formatRelative, parseChannels } from "@/shared/utils/format";
import { tick } from "@/shared/utils/native/haptics";

const props = defineProps<{ build: NativeBuild; href: string; installed: boolean }>();
const { t, locale } = useI18n();
const served = computed(() => parseChannels(props.build.channels));
</script>

<style scoped>
.build-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  color: var(--foreground);
  transition: background-color var(--duration-short) linear;
}

.build-item:active {
  background: var(--muted);
}

.build-item.installed {
  background: color-mix(in srgb, var(--primary-container) 22%, transparent);
}

.build-version {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 76px;
}

.served-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding-inline: 8px;
  border-radius: var(--radius-sm);
  background: var(--secondary);
  color: var(--secondary-foreground);
  font-size: 11px;
  font-weight: 600;
}

.served-chip.required {
  background: var(--destructive-container);
  color: var(--destructive-container-foreground);
}
</style>
