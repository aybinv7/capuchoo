<script setup lang="ts">
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { Panel, VueFlow, useVueFlow } from "@vue-flow/core";
import { MiniMap } from "@vue-flow/minimap";
import { watch } from "vue";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/controls/dist/style.css";
import "@vue-flow/minimap/dist/style.css";
import type { CanvasGraph } from "../lib/layout";
import type { BuildNodeData, ChannelNodeData, LaneNodeData } from "../types/canvas.types";
import ArtefactShelf from "./ArtefactShelf.vue";
import CanvasLegend from "./CanvasLegend.vue";
import BuildNode from "./nodes/BuildNode.vue";
import ChannelNode from "./nodes/ChannelNode.vue";
import LaneNode from "./nodes/LaneNode.vue";

const props = defineProps<{ graph: CanvasGraph; flowId: string }>();

const { fitView } = useVueFlow(props.flowId);

watch(
  () => props.graph.nodes.length,
  () => requestAnimationFrame(() => void fitView({ padding: 0.15, maxZoom: 1 })),
);

const minimapColor = (node: { type?: string }) =>
  node.type === "build"
    ? "var(--info)"
    : node.type === "lane"
      ? "transparent"
      : "var(--muted-foreground)";
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      class="bg-background/95 relative z-10 flex h-12 shrink-0 items-center justify-end gap-2 border-b px-3 backdrop-blur"
    >
      <slot name="toolbar" />
      <ArtefactShelf />
    </div>
    <VueFlow
      :id="props.flowId"
      :nodes="props.graph.nodes"
      :edges="props.graph.edges"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :elements-selectable="false"
      :zoom-on-double-click="false"
      :zoom-on-scroll="true"
      :prevent-scrolling="true"
      :min-zoom="0.3"
      :max-zoom="1.6"
      :fit-view-on-init="true"
      class="release-canvas min-h-0 flex-1"
    >
      <template #node-channel="{ data }">
        <ChannelNode :data="data as ChannelNodeData" />
      </template>
      <template #node-build="{ data }">
        <BuildNode :data="data as BuildNodeData" />
      </template>
      <template #node-lane="{ data }">
        <LaneNode :data="data as LaneNodeData" />
      </template>

      <Background variant="dots" :gap="18" :size="1" pattern-color="var(--grid)" />
      <Controls :show-interactive="false" position="bottom-right" />
      <MiniMap
        pannable
        zoomable
        position="bottom-right"
        class="!right-12 hidden md:block"
        :node-color="minimapColor"
        mask-color="color-mix(in oklch, var(--background) 70%, transparent)"
      />
      <Panel position="bottom-left">
        <CanvasLegend />
      </Panel>
    </VueFlow>
  </div>
</template>

<style>
.release-canvas {
  --vf-node-bg: transparent;
  --vf-node-text: var(--foreground);
  --vf-connection-path: var(--muted-foreground);
  --vf-handle: var(--border);
}

.release-canvas .vue-flow__node {
  border: 0;
  padding: 0;
  background: transparent;
  box-shadow: none;
  cursor: default;
}

.release-canvas .vue-flow__edge-path {
  stroke: color-mix(in oklch, var(--muted-foreground) 55%, transparent);
  stroke-width: 1.5;
}

.release-canvas .vue-flow__edge.edge-promote .vue-flow__edge-path {
  stroke-dasharray: 6 5;
}

.release-canvas .vue-flow__edge.edge-build-live .vue-flow__edge-path {
  stroke: var(--info);
  stroke-width: 2;
}

.release-canvas .vue-flow__edge.edge-build-failed .vue-flow__edge-path {
  stroke: color-mix(in oklch, var(--destructive) 60%, transparent);
}

.release-canvas .vue-flow__edge-textbg {
  fill: var(--background);
}

.release-canvas .vue-flow__edge-text {
  fill: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 10px;
}

.release-canvas .vue-flow__controls {
  box-shadow: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.release-canvas .vue-flow__controls-button {
  background: var(--card);
  border-bottom-color: var(--border);
  fill: var(--foreground);
}

.release-canvas .vue-flow__minimap {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
</style>
