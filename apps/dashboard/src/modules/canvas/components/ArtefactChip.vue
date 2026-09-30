<script setup lang="ts">
import { GripVertical } from "@lucide/vue";
import { cn } from "@/lib/utils";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import VersionTag from "@/shared/components/VersionTag.vue";
import type { Artefact } from "@/shared/types/release";
import { useCanvasDrag } from "../composables/useCanvasDrag";

const props = withDefaults(
  defineProps<{
    artefact: Artefact;
    sourceChannelId?: string | null;
    showFlavour?: boolean;
    class?: string;
  }>(),
  { sourceChannelId: null, showFlavour: false },
);

const drag = useCanvasDrag();
</script>

<template>
  <button
    type="button"
    draggable="true"
    :class="
      cn(
        'nodrag nopan group bg-background hover:border-foreground/30 inline-flex cursor-grab items-center gap-1 rounded-md border px-1.5 py-0.5 active:cursor-grabbing',
        drag.artefact.value?.id === props.artefact.id && 'border-primary ring-primary/30 ring-2',
        props.class,
      )
    "
    :title="`Drag ${props.artefact.version_name} onto a channel to deliver it`"
    @dragstart="drag.start($event, props.artefact, props.sourceChannelId)"
    @dragend="drag.end()"
  >
    <GripVertical class="text-muted-foreground size-3 opacity-50 group-hover:opacity-100" />
    <VersionTag
      :kind="props.artefact.kind"
      :version="props.artefact.version_name"
      :code="props.artefact.kind === 'native' ? props.artefact.version_code : null"
    />
    <EnvBadge v-if="props.showFlavour" :environment="props.artefact.flavour" size="sm" />
  </button>
</template>
