<template>
  <F7Sheet
    :opened="Boolean(channel)"
    swipe-to-close
    backdrop
    push
    class="deliver-sheet"
    style="height: auto; max-height: 80vh"
    @sheet:closed="emit('close')"
  >
    <div class="swipe-handler" />
    <F7PageContent class="pb-6!">
      <div v-if="channel" class="px-6 pt-1 pb-3">
        <p class="text-[22px] leading-7 font-semibold">
          {{ t("deliver.sheetTitle", { channel: channel.name }) }}
        </p>
        <p class="mt-1 text-sm text-muted-foreground">{{ t("deliver.sheetText") }}</p>
      </div>
      <div class="flex flex-col">
        <button
          v-for="build in eligible"
          :key="build.id"
          type="button"
          class="deliver-row"
          :class="{ current: build.id === channel?.current_native_id }"
          :disabled="build.id === channel?.current_native_id"
          @click="emit('pick', build, isRollback(build))"
        >
          <span class="cap-mono w-24 shrink-0 text-start text-base font-semibold">{{
            build.version_name
          }}</span>
          <span class="cap-mono w-12 shrink-0 text-start text-xs text-muted-foreground"
            >#{{ build.version_code }}</span
          >
          <span class="min-w-0 flex-1 truncate text-start text-xs text-muted-foreground">{{
            formatRelative(build.created_at, locale)
          }}</span>
          <span
            v-if="build.id === channel?.current_native_id"
            class="text-xs font-semibold text-primary"
            >{{ t("deliver.current") }}</span
          >
          <span v-else-if="isRollback(build)" class="text-xs font-semibold text-destructive">{{
            t("deliver.rollback")
          }}</span>
        </button>
        <p v-if="!eligible.length" class="px-6 py-4 text-sm text-muted-foreground">
          {{ t("deliver.none") }}
        </p>
      </div>
    </F7PageContent>
  </F7Sheet>
</template>

<script setup lang="ts">
import type { Channel, NativeBuild } from "@/domains/catalog/catalog.repository";
import { formatRelative } from "@/shared/utils/format";

/**
 * The builds a channel can be pointed at: its environment's flavour, or builds every flavour
 * shares. A lower build than the one it serves is a rollback and says so.
 */
const props = defineProps<{ channel: Channel | null; builds: NativeBuild[] }>();
const emit = defineEmits<{ close: []; pick: [build: NativeBuild, rollback: boolean] }>();
const { t, locale } = useI18n();

const current = computed(
  () => props.builds.find((build) => build.id === props.channel?.current_native_id) ?? null,
);

const eligible = computed(() =>
  props.builds.filter(
    (build) =>
      !build.flavour || !props.channel?.environment || build.flavour === props.channel.environment,
  ),
);

function isRollback(build: NativeBuild): boolean {
  return Boolean(current.value && build.version_code < current.value.version_code);
}
</script>

<style scoped>
.deliver-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100% !important;
  min-height: 56px;
  padding-inline: 24px;
  color: var(--foreground);
  transition: background-color var(--duration-short) linear;
}

.deliver-row:active:not(:disabled) {
  background: var(--muted);
}

.deliver-row.current {
  background: color-mix(in srgb, var(--primary-container) 25%, transparent);
}
</style>
