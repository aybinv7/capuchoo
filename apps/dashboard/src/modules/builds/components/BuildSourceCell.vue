<script setup lang="ts">
import { GitBranch, SquareArrowOutUpRight, Tag } from "@lucide/vue";
import ProviderIcon from "@/shared/components/ProviderIcon.vue";
import { shortId } from "@/shared/lib/format";
import type { Build } from "@/shared/types/build";
import { displayRef, isTagRef, providerLabel } from "@/shared/lib/run-meta";

defineProps<{ build: Build }>();
</script>

<template>
  <div class="flex min-w-0 items-center gap-2 text-xs">
    <span
      class="text-muted-foreground flex shrink-0 items-center"
      :title="providerLabel(build.source)"
    >
      <ProviderIcon :provider="build.source" />
    </span>
    <span v-if="build.ref" class="text-muted-foreground flex min-w-0 items-center gap-1">
      <Tag v-if="isTagRef(build)" class="size-3 shrink-0" />
      <GitBranch v-else class="size-3 shrink-0" />
      <span class="truncate font-mono">{{ displayRef(build.ref) }}</span>
    </span>
    <span v-if="build.commit_sha" class="text-muted-foreground font-mono">{{
      shortId(build.commit_sha, 7)
    }}</span>
    <a
      v-if="build.pipeline_url"
      :href="build.pipeline_url"
      target="_blank"
      rel="noopener noreferrer"
      class="text-muted-foreground hover:text-foreground ml-auto shrink-0"
      :aria-label="`Open in ${providerLabel(build.source)}`"
      @click.stop
    >
      <SquareArrowOutUpRight class="size-3.5" />
    </a>
  </div>
</template>
