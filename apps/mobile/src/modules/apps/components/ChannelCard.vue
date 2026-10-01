<template>
  <article class="channel-card" :class="{ paused: view.channel.paused }">
    <span class="channel-stripe" :class="`stripe-${view.channel.environment ?? 'none'}`" aria-hidden="true" />
    <div class="flex min-w-0 flex-1 flex-col gap-2">
      <div class="flex items-center gap-2">
        <p class="truncate text-base font-semibold">{{ view.channel.name }}</p>
        <EnvironmentChip :environment="view.channel.environment" />
        <span v-if="view.channel.kind === 'client'" class="truncate text-xs text-muted-foreground">
          {{ t("channel.follows", { base: view.base?.name ?? "—" }) }}
        </span>
      </div>

      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span class="flex items-baseline gap-1.5">
          <F7Icon md="material:android" size="16" class="text-muted-foreground" />
          <span class="cap-mono text-sm font-semibold">{{ versionLabel(view.native?.version_name, view.native?.version_code) }}</span>
        </span>
        <span v-if="view.bundle" class="flex items-baseline gap-1.5">
          <F7Icon md="material:bolt" size="16" class="text-muted-foreground" />
          <span class="cap-mono text-sm">{{ view.bundle.version_name }}</span>
        </span>
      </div>

      <p v-if="view.channel.paused" class="flex items-center gap-1 text-xs font-semibold text-destructive">
        <F7Icon md="material:pause_circle" size="16" />{{ t("channel.pausedLong") }}
      </p>
    </div>

    <div v-if="canDeliver" class="flex shrink-0 flex-col items-end gap-1">
      <F7Button tonal round small class="w-auto!" :disabled="busy" @click="emit('deliver')">
        {{ t("channel.deliver") }}
      </F7Button>
      <F7Link class="text-xs!" :class="view.channel.paused ? 'text-primary!' : 'text-muted-foreground!'" :disabled="busy" @click="emit('togglePause')">
        {{ view.channel.paused ? t("channel.resume") : t("channel.pause") }}
      </F7Link>
    </div>
  </article>
</template>

<script setup lang="ts">
import EnvironmentChip from "@/shared/components/app/EnvironmentChip.vue";
import { versionLabel } from "@/shared/utils/format";
import type { ChannelView } from "../composables/useAppDetail";

defineProps<{ view: ChannelView; canDeliver: boolean; busy: boolean }>();
const emit = defineEmits<{ deliver: []; togglePause: [] }>();
const { t } = useI18n();
</script>

<style scoped>
.channel-card {
  position: relative;
  display: flex;
  gap: 12px;
  padding: 14px 14px 14px 20px;
  border-radius: var(--radius-lg-increased);
  background: var(--card);
  box-shadow: var(--elevation-card);
  overflow: hidden;
}

.channel-card.paused {
  background: color-mix(in srgb, var(--destructive-container) 35%, var(--card));
}

.channel-stripe {
  position: absolute;
  inset-block: 10px;
  inset-inline-start: 6px;
  width: 4px;
  border-radius: 999px;
  background: var(--muted-foreground);
}

.stripe-dev {
  background: var(--env-dev);
}

.stripe-staging {
  background: var(--env-staging);
}

.stripe-prod {
  background: var(--env-prod);
}
</style>
