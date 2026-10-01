<template>
  <F7ListItem
    :link="actionable ? '#' : false"
    :class="{ 'channel-paused': view.channel.paused }"
    @click="onClick"
  >
    <template #media>
      <span class="grid size-10 place-items-center rounded-xl" :class="tone">
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
      <EnvironmentChip :environment="view.channel.environment" />
    </template>
    <template #subtitle>
      <span class="flex flex-wrap items-center gap-x-3">
        <span class="inline-flex items-center gap-1">
          <F7Icon md="material:android" size="16" class="text-muted-foreground" />
          <span class="cap-mono font-semibold">{{
            versionLabel(view.native?.version_name, view.native?.version_code)
          }}</span>
        </span>
        <span v-if="view.bundle" class="inline-flex items-center gap-1">
          <F7Icon md="material:bolt" size="16" class="text-muted-foreground" />
          <span class="cap-mono">{{ view.bundle.version_name }}</span>
        </span>
      </span>
    </template>
    <template v-if="caption" #text>
      <span :class="{ 'font-semibold text-destructive': view.channel.paused }">{{ caption }}</span>
    </template>
  </F7ListItem>
</template>

<script setup lang="ts">
import EnvironmentChip from "@/shared/components/app/EnvironmentChip.vue";
import { versionLabel } from "@/shared/utils/format";
import { tick } from "@/shared/utils/native/haptics";
import type { ChannelView } from "../composables/useAppDetail";

/** A channel and what it serves. A row the person may act on opens its actions; others only inform. */
const props = defineProps<{ view: ChannelView; actionable: boolean }>();
const emit = defineEmits<{ open: [] }>();
const { t } = useI18n();

const TONES: Record<string, string> = {
  dev: "bg-env-dev-container text-env-dev-foreground",
  staging: "bg-env-staging-container text-env-staging-foreground",
  prod: "bg-env-prod-container text-env-prod-foreground",
};

const tone = computed(
  () => TONES[props.view.channel.environment ?? ""] ?? "bg-muted text-muted-foreground",
);

const caption = computed(() => {
  if (props.view.channel.paused) return t("channel.pausedLong");
  if (props.view.channel.kind === "client")
    return t("channel.follows", { base: props.view.base?.name ?? "—" });
  return "";
});

function onClick(): void {
  if (!props.actionable) return;
  tick();
  emit("open");
}
</script>
