<script setup lang="ts">
import { Controls } from "@vue-flow/controls";
import { VueFlow, useVueFlow, type NodeMouseEvent } from "@vue-flow/core";
import { computed, markRaw, onBeforeUnmount, watch } from "vue";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/controls/dist/style.css";
import {
  diffFlowNodes,
  edgeSignature,
  toFlowEdges,
  toFlowNodes,
  type FlowNode,
  type StageLabelData,
} from "../../lib/pipeline-flow";
import type { PipelineModel, PipelineNodeModel } from "../../lib/pipeline-graph";
import { layoutPipeline } from "../../lib/pipeline-layout";
import JobNode from "./JobNode.vue";

const props = defineProps<{ model: PipelineModel; flowId: string; selectedId: string | null }>();
const emit = defineEmits<{ open: [id: string] }>();

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 560;
const FIT = { padding: 0.12, maxZoom: 1, duration: 0 } as const;
const FIT_CONTROL = { padding: 0.12, maxZoom: 1, duration: 200 } as const;

const { addNodes, removeNodes, updateNode, setNodes, setEdges, fitView } = useVueFlow(props.flowId);

let rendered = new Map<string, FlowNode>();
let renderedEdges = "";
let frame = 0;

const layout = computed(() => layoutPipeline(props.model));
const height = computed(() => Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, layout.value.height + 72)));

const raw = (node: FlowNode): FlowNode => ({ ...node, data: markRaw(node.data) }) as FlowNode;

function refit() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => void fitView(FIT));
}

function patch(model: PipelineModel) {
  const next = toFlowNodes(model, layout.value);
  const first = rendered.size === 0;
  const changes = diffFlowNodes(rendered, next);
  if (first) {
    setNodes(next.map(raw));
  } else {
    if (changes.remove.length) removeNodes(changes.remove, false);
    if (changes.add.length) addNodes(changes.add.map(raw));
    for (const node of changes.update)
      updateNode(node.id, { position: node.position, data: markRaw(node.data) });
  }
  rendered = new Map(next.map((node) => [node.id, node]));

  const edges = toFlowEdges(model);
  const signature = edgeSignature(edges);
  if (signature !== renderedEdges) {
    setEdges(edges);
    renderedEdges = signature;
  }
  if (changes.add.length || changes.remove.length) refit();
}

function onNodeClick({ node }: NodeMouseEvent) {
  if (node.type === "job") emit("open", node.id);
}

watch(() => props.model, patch, { immediate: true });
onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
  <div class="pipeline-graph dot-grid relative w-full" :style="{ height: `${height}px` }">
    <VueFlow
      :id="props.flowId"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :nodes-focusable="false"
      :edges-focusable="false"
      :elements-selectable="false"
      :zoom-on-scroll="true"
      :zoom-on-pinch="true"
      :pan-on-drag="true"
      :zoom-on-double-click="false"
      :prevent-scrolling="true"
      :min-zoom="0.3"
      :max-zoom="1.75"
      :fit-view-on-init="true"
      @nodes-initialized="refit"
      @node-click="onNodeClick"
    >
      <template #node-job="{ id, data }">
        <JobNode :node="data as PipelineNodeModel" :selected="id === props.selectedId" />
      </template>
      <template #node-stage="{ data }">
        <span
          class="text-muted-foreground block text-[11px] font-medium tracking-wide whitespace-nowrap uppercase"
          >{{ (data as StageLabelData).label }}</span
        >
      </template>
      <Controls :show-interactive="false" :fit-view-params="FIT_CONTROL" position="bottom-right" />
    </VueFlow>
  </div>
</template>

<style>
.pipeline-graph .vue-flow__node {
  border: 0;
  padding: 0;
  background: transparent;
  box-shadow: none;
  cursor: default;
}

.pipeline-graph .vue-flow__node-job {
  cursor: pointer;
}

.pipeline-graph .vue-flow__pane {
  cursor: grab;
}

.pipeline-graph .vue-flow__pane.dragging {
  cursor: grabbing;
}

.pipeline-graph .vue-flow__edge-path {
  stroke: color-mix(in oklch, var(--muted-foreground) 45%, transparent);
  stroke-width: 1.5;
}

.pipeline-graph .pipeline-edge-done .vue-flow__edge-path {
  stroke: color-mix(in oklch, var(--success) 55%, transparent);
}

.pipeline-graph .pipeline-edge-active .vue-flow__edge-path {
  stroke: var(--info);
  stroke-width: 2;
}

.pipeline-graph .pipeline-edge-failed .vue-flow__edge-path {
  stroke: color-mix(in oklch, var(--destructive) 55%, transparent);
}

.pipeline-graph .pipeline-edge-muted .vue-flow__edge-path {
  stroke: color-mix(in oklch, var(--muted-foreground) 30%, transparent);
  stroke-dasharray: 4 4;
}

@media (prefers-reduced-motion: reduce) {
  .pipeline-graph .vue-flow__edge.animated path {
    animation: none;
  }
}

.pipeline-graph .vue-flow__controls {
  box-shadow: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.pipeline-graph .vue-flow__controls-button {
  background: var(--card);
  border-bottom-color: var(--border);
  fill: var(--foreground);
}
</style>
