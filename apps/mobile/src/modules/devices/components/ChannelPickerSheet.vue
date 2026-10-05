<template>
  <F7Sheet
    class="channel-picker"
    :opened="opened"
    swipe-to-close
    backdrop
    close-by-backdrop-click
    @sheet:closed="emit('close')"
  >
    <div class="swipe-handler" />
    <F7PageContent class="channel-picker-content">
      <div class="px-6 pt-1 pb-2">
        <p class="m-0 text-[22px] leading-7 font-semibold">{{ t("device.assignTitle") }}</p>
        <p class="mt-1 mb-0 text-sm text-muted-foreground">
          {{ t("device.assignText", { device: deviceName }) }}
        </p>
      </div>

      <F7List strong inset dividers media-list class="rounded-2xl!">
        <F7ListItem
          v-for="view in channels"
          :key="view.channel.id"
          link="#"
          :no-chevron="true"
          @click="pick(view.channel)"
        >
          <template #media>
            <span class="grid size-10 place-items-center rounded-xl" :class="toneOf(view)">
              <F7Icon
                :md="`material:${view.channel.kind === 'client' ? 'business' : 'layers'}`"
                size="20"
              />
            </span>
          </template>
          <template #title>
            <span class="font-semibold">{{ view.channel.name }}</span>
          </template>
          <template #after>
            <F7Icon
              v-if="view.channel.id === overrideId"
              md="material:check_circle"
              size="24"
              class="text-primary"
            />
            <span v-else-if="view.channel.id === servedId" class="text-xs font-semibold">{{
              t("device.servingNow")
            }}</span>
          </template>
          <template #subtitle>
            <span class="cap-mono">{{
              versionLabel(view.native?.version_name, view.native?.version_code)
            }}</span>
            <span v-if="view.channel.paused" class="ms-2 font-semibold text-destructive">{{
              t("channel.paused")
            }}</span>
          </template>
        </F7ListItem>
      </F7List>

      <F7List v-if="canClear" strong inset class="rounded-2xl!">
        <F7ListButton class="list-button-danger" @click="pick(null)">
          {{ t("device.clearOverride") }}
        </F7ListButton>
      </F7List>
      <F7BlockFooter v-else-if="!overrideId">{{ t("device.assignHint") }}</F7BlockFooter>
    </F7PageContent>
  </F7Sheet>
</template>

<script setup lang="ts">
import type { Channel } from "@/domains/catalog/catalog.repository";
import type { ChannelView } from "@/shared/composables/release/useAppRelease";
import { versionLabel } from "@/shared/utils/format";
import { tick } from "@/shared/utils/native/haptics";

/**
 * Where a device is served from, as an M3 bottom sheet: each channel this account may move it to,
 * in its environment's tone with the build it serves, the override marked, and a way to clear it.
 */
defineProps<{
  opened: boolean;
  deviceName: string;
  channels: ChannelView[];
  overrideId: string | null;
  servedId: string | null;
  canClear: boolean;
}>();
const emit = defineEmits<{ close: []; pick: [channel: Channel | null] }>();
const { t } = useI18n();

const TONES: Record<string, string> = {
  dev: "bg-env-dev-container text-env-dev-foreground",
  staging: "bg-env-staging-container text-env-staging-foreground",
  prod: "bg-env-prod-container text-env-prod-foreground",
};

function toneOf(view: ChannelView): string {
  return TONES[view.channel.environment ?? ""] ?? "bg-muted text-muted-foreground";
}

function pick(channel: Channel | null): void {
  tick();
  emit("pick", channel);
}
</script>

<style>
.channel-picker.sheet-modal {
  height: auto;
  max-height: 85vh;
}

.channel-picker .channel-picker-content {
  max-height: calc(85vh - 28px);
  padding-bottom: calc(var(--f7-safe-area-bottom) + 16px);
}
</style>
