<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import { GitCommitHorizontal, SquareArrowOutUpRight, TerminalSquare } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import BuildStatusBadge from "@/shared/components/BuildStatusBadge.vue";
import ElapsedTime from "@/shared/components/ElapsedTime.vue";
import { findArtefact } from "@/shared/delivery/lib/eligibility";
import { shortId } from "@/shared/lib/format";
import { isBuildActive } from "@/shared/lib/tone";
import { useBuild } from "@/shared/queries/useBuilds";
import { RouteName } from "@/shared/router/route-names";
import { useCanvasContext } from "../../composables/useCanvasContext";
import type { BuildNodeData } from "../../types/canvas.types";
import ArtefactChip from "../ArtefactChip.vue";
import BuildStepStrip from "../BuildStepStrip.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ data: BuildNodeData }>();

const build = computed(() => props.data.build);
const active = computed(() => isBuildActive(build.value.status));
const { catalog } = useCanvasContext();
const detail = useBuild(computed(() => (active.value ? build.value.id : null)));

const artefact = computed(() => {
  const id = build.value.bundle_id ?? build.value.native_id;
  return id ? (findArtefact(catalog.value, id) ?? null) : null;
});
</script>

<template>
  <div class="bg-card w-[248px] rounded-lg border shadow-sm">
    <header class="flex items-center justify-between gap-2 border-b px-3 py-2">
      <BuildStatusBadge :status="build.status" />
      <span class="text-muted-foreground text-[11px]">
        <ElapsedTime :from="build.started_at ?? build.created_at" :to="build.finished_at" />
      </span>
    </header>
    <div class="space-y-2 px-3 py-2">
      <div class="flex items-center gap-2 text-xs">
        <span class="bg-muted rounded px-1 font-mono text-[10px] uppercase">{{ build.kind }}</span>
        <span class="truncate font-mono font-medium">{{
          build.version_name ?? "unversioned"
        }}</span>
        <span
          v-if="build.channel_name"
          class="text-muted-foreground ml-auto truncate font-mono text-[11px]"
          >→ {{ build.channel_name }}</span
        >
      </div>
      <BuildStepStrip v-if="active" :events="detail.data.value?.events ?? []" />
      <p
        v-else-if="build.error"
        class="text-destructive line-clamp-2 text-[11px]"
        :title="build.error"
      >
        {{ build.error }}
      </p>
      <ArtefactChip v-else-if="artefact" :artefact="artefact" show-flavour />
      <div class="text-muted-foreground flex items-center gap-2 text-[11px]">
        <TerminalSquare v-if="build.source === 'cli'" class="size-3" />
        <GitCommitHorizontal v-else class="size-3" />
        <span>{{ build.source }}</span>
        <span v-if="build.commit_sha" class="font-mono">{{ shortId(build.commit_sha, 7) }}</span>
        <a
          v-if="build.pipeline_url"
          :href="build.pipeline_url"
          target="_blank"
          rel="noopener noreferrer"
          class="nodrag hover:text-foreground ml-auto"
          aria-label="Open the pipeline"
        >
          <SquareArrowOutUpRight class="size-3" />
        </a>
        <RouterLink
          :to="{ name: RouteName.build, params: { buildId: build.id } }"
          class="nodrag hover:text-foreground"
          :class="!build.pipeline_url && 'ml-auto'"
          >details</RouterLink
        >
      </div>
    </div>
    <Handle
      type="source"
      :position="Position.Right"
      :connectable="false"
      class="!bg-border !size-2 !border-0"
    />
  </div>
</template>
