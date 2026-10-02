<script setup lang="ts">
import { GitBranch, Tag } from "@lucide/vue";
import { RouterLink } from "vue-router";
import ProviderIcon from "@/shared/components/ProviderIcon.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import StatusDot from "@/shared/components/StatusDot.vue";
import { buildTitle, displayRef, isTagRef, providerLabel } from "@/shared/lib/run-meta";
import { buildTone, isBuildActive } from "@/shared/lib/tone";
import { RouteName } from "@/shared/router/route-names";
import type { Build } from "@/shared/types/build";

const props = defineProps<{ build: Build }>();
</script>

<template>
  <RouterLink
    :to="{ name: RouteName.build, params: { buildId: props.build.id } }"
    class="hover:bg-accent/60 focus-visible:ring-ring/50 flex min-w-0 items-center gap-3 rounded-md px-2 py-2 outline-none focus-visible:ring-3"
  >
    <StatusDot
      :tone="buildTone(props.build.status)"
      :pulse="isBuildActive(props.build.status)"
      :aria-label="props.build.status"
    />
    <span class="min-w-0 flex-1 space-y-0.5">
      <span class="block truncate text-sm" :title="buildTitle(props.build)">{{
        buildTitle(props.build)
      }}</span>
      <span class="text-muted-foreground flex min-w-0 items-center gap-1.5 text-[11px]">
        <span class="flex shrink-0 items-center" :title="providerLabel(props.build.source)">
          <ProviderIcon :provider="props.build.source" class="size-3" />
        </span>
        <template v-if="props.build.ref">
          <Tag v-if="isTagRef(props.build)" class="size-3 shrink-0" />
          <GitBranch v-else class="size-3 shrink-0" />
          <span class="truncate font-mono">{{ displayRef(props.build.ref) }}</span>
        </template>
        <span v-if="props.build.version_name" class="shrink-0 font-mono"
          >· {{ props.build.version_name }}</span
        >
      </span>
    </span>
    <RelativeTime
      :value="props.build.started_at ?? props.build.created_at"
      class="text-muted-foreground shrink-0 text-xs"
    />
  </RouterLink>
</template>
