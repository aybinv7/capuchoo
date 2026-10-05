<template>
  <F7ListItem :link="href" :class="{ 'channel-paused': view.channel.paused }" @click="tick">
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
import type { ChannelStats } from "@/shared/api/types";
import EnvironmentChip from "@/shared/components/app/EnvironmentChip.vue";
import type { ChannelView } from "@/shared/composables/release/useAppRelease";
import { formatPercent, versionLabel } from "@/shared/utils/format";
import { tick } from "@/shared/utils/native/haptics";

/** A channel, what it serves and, when the server has counted it, how much of its fleet runs that. */
const props = defineProps<{ view: ChannelView; href: string; health?: ChannelStats | null }>();
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
  const parts: string[] = [];
  if (props.view.channel.kind === "client")
    parts.push(t("channel.follows", { base: props.view.base?.name ?? "—" }));
  const health = props.health;
  if (health?.devices)
    parts.push(
      t(
        "channel.fleet",
        { count: health.devices, share: formatPercent(health.on_current / health.devices) },
        health.devices,
      ),
    );
  return parts.join(" · ");
});
</script>
