<script setup lang="ts">
import { LayoutGrid, RadioTower } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import RunPipelineButton from "@/shared/ci/components/RunPipelineButton.vue";
import RunPipelineDialogHost from "@/shared/ci/components/RunPipelineDialogHost.vue";
import { useRunGate } from "@/shared/ci/composables/useRunGate";
import { useRunPipelineDialog } from "@/shared/ci/composables/useRunPipelineDialog";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import DeliveryDialogHost from "@/shared/delivery/components/DeliveryDialogHost.vue";
import { useDeliveryDialogs } from "@/shared/delivery/composables/useDeliveryDialogs";
import { RouteName } from "@/shared/router/route-names";
import ReleaseCanvas from "../components/ReleaseCanvas.vue";
import { provideCanvasContext } from "../composables/useCanvasContext";
import { provideCanvasDrag } from "../composables/useCanvasDrag";
import { useCanvasGraph } from "../composables/useCanvasGraph";
import { useCanvasPositions } from "../composables/useCanvasPositions";
import { useNodeHeights } from "../composables/useNodeHeights";
import { useServedByBases } from "../composables/useServedByBases";

const { appId, app } = useCurrentApp();
const { heights, onNodesChange } = useNodeHeights();
const layout = useCanvasPositions(appId);
const { graph, catalog, isPending, error, refetch } = useCanvasGraph(appId, {
  heights,
  positions: layout.positions,
});
const servedByBase = useServedByBases(computed(() => catalog.value.channels));
const dialogs = useDeliveryDialogs();
const runDialog = useRunPipelineDialog();
const runGate = useRunGate();

provideCanvasContext({
  catalog,
  servedByBase,
  dialogs,
  pipeline: { reason: runGate.reason, run: runDialog.show },
});
provideCanvasDrag();

const flowId = computed(() => `release-canvas-${appId.value}`);
</script>

<template>
  <div class="relative h-[calc(100svh-3rem)] min-h-[520px] w-full">
    <div v-if="error && !graph.nodes.length" class="mx-auto max-w-xl p-6">
      <ErrorNotice :error="error" :retry="refetch" />
    </div>
    <div v-else-if="isPending" class="dot-grid flex h-full items-start gap-24 p-10">
      <Skeleton v-for="index in 4" :key="index" class="h-48 w-64 rounded-lg" />
    </div>
    <div
      v-else-if="catalog.channels.length === 0"
      class="dot-grid grid h-full place-items-center p-6"
    >
      <EmptyState
        :icon="RadioTower"
        title="Nothing to map yet"
        :description="`${app?.name ?? 'This app'} has no channels. The first capuchoo deploy creates dev, staging and prod.`"
        class="bg-background max-w-md"
      >
        <Button as-child variant="outline">
          <RouterLink :to="{ name: RouteName.channels }">Open channels</RouterLink>
        </Button>
      </EmptyState>
    </div>
    <ReleaseCanvas
      v-else
      :key="flowId"
      :graph="graph"
      :flow-id="flowId"
      @nodes-change="onNodesChange"
      @moved="layout.move"
    >
      <template #toolbar>
        <Button
          v-if="layout.moved.value"
          variant="ghost"
          size="sm"
          title="Put every card back where the automatic layout places it"
          @click="layout.reset()"
        >
          <LayoutGrid />
          Reset layout
        </Button>
        <RunPipelineButton variant="outline" @run="runDialog.show()" />
      </template>
    </ReleaseCanvas>
    <DeliveryDialogHost :controller="dialogs" />
    <RunPipelineDialogHost :controller="runDialog" />
  </div>
</template>
