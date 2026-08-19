<template>
  <div class="h-full w-full relative overflow-hidden flex bg-background">
    <!-- Main Canvas Area -->
    <div class="relative flex-1 h-full overflow-hidden" :class="{ 'deploy-storm': isStorming }">
      <VueFlow
        v-model="elements"
        :default-viewport="{ zoom: 1.2 }"
        :min-zoom="0.1"
        :max-zoom="4"
        fit-view-on-init
        class="bg-muted/5 w-full h-full"
      >
        <!-- Background Pattern -->
        <Background pattern-color="#aaa" :gap="20" />

        <!-- MiniMap -->
        <MiniMap
          class="bg-background! border-sidebar-border! rounded-xl! shadow-lg!"
          :node-stroke-color="'#e2e8f0'"
          :node-color="'#f8fafc'"
          pannable
          zoomable
        />

        <!-- Controls -->
        <Controls />

        <!-- Custom Nodes -->
        <template #node-app="props">
          <AppNode :data="props.data" :selected="props.selected" />
        </template>
        <template #node-channel="props">
          <ChannelNode :data="props.data" :selected="props.selected" />
        </template>
        <template #node-bundle="props">
          <BundleNode :data="props.data" :selected="props.selected" />
        </template>
        <template #node-github="props">
          <GithubNode :data="props.data" :selected="props.selected" />
        </template>
        <template #node-device="props">
          <DeviceFleetNode :data="props.data" :selected="props.selected" />
        </template>

        <!-- Custom Edges -->
        <template #edge-flow="props">
          <DataFlowEdge v-bind="props" />
        </template>
        <template #edge-pipeline="props">
          <PipelineEdge v-bind="props" />
        </template>
      </VueFlow>

      <!-- Sidebar: Node Gallery (Left Palette) -->
      <div
        class="absolute top-20 left-4 z-20 flex flex-col gap-2 p-1 bg-background/60 backdrop-blur-sm border rounded-xl shadow-lg"
      >
        <div
          class="p-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center border-b mb-1"
        >
          Library
        </div>
        <Button @click="addNode('channel')" variant="ghost">
          <ILucideRadio class="size-5 text-muted-foreground group-hover:text-primary" />
          <span
            class="absolute left-full ml-2 px-2 py-1 bg-popover border text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity"
            >Add Channel</span
          >
        </Button>
        <Button @click="addNode('github')" variant="ghost">
          <ILucideGithub class="size-5 text-muted-foreground group-hover:text-purple-600" />
          <span
            class="absolute left-full ml-2 px-2 py-1 bg-popover border text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity"
            >Add GitHub Source</span
          >
        </Button>
        <Button @click="addNode('bundle')" variant="ghost">
          <ILucidePackage class="size-5 text-muted-foreground group-hover:text-emerald-600" />
          <span
            class="absolute left-full ml-2 px-2 py-1 bg-popover border text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity"
            >Add Bundle</span
          >
        </Button>
        <Button @click="addNode('device')" variant="ghost">
          <ILucideSmartphone class="size-5 text-muted-foreground group-hover:text-blue-600" />
          <span
            class="absolute left-full ml-2 px-2 py-1 bg-popover border text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity"
            >Add Device</span
          >
        </Button>
      </div>

      <!-- Floating Toolbar (Absolute overlay on Canvas Area) -->
      <div
        class="absolute top-4 left-4 z-20 p-2 bg-background/80 backdrop-blur-md border rounded-lg shadow-md flex items-center gap-2 pointer-events-auto"
      >
        <div class="flex items-center gap-2 px-2 border-r pr-4 mr-2">
          <Button variant="ghost" size="icon" @click="router.back()">
            <ILucideArrowLeft class="size-4" />
          </Button>
          <span class="font-semibold text-sm">Visual Editor</span>
        </div>
        <Button variant="secondary" size="sm" class="gap-1.5" @click="saveGraph">
          <ILucideSave class="size-4" />
          Save Layout
        </Button>
        <Button variant="outline" size="sm" class="gap-1.5" @click="autoLayout">
          <ILucideLayout class="size-4" />
          Auto Layout
        </Button>
      </div>

      <!-- Properties Sidebar (Positioned right as a floating overlay or pushed) -->
      <!-- Using absolute to ensure it doesn't jitter on large screen flex containers -->
      <aside
        class="absolute top-4 bottom-4 right-4 z-30 w-[350px] bg-background border shadow-2xl rounded-2xl flex flex-col transition-all duration-500 ease-in-out"
        :class="
          hasSelection
            ? 'translate-x-0 opacity-100'
            : 'translate-x-[calc(100%+2rem)] opacity-0 pointer-events-none'
        "
      >
        <div class="p-5 border-b bg-muted/10 flex justify-between items-center shrink-0">
          <h3 class="font-semibold text-base">
            {{
              selectedNode?.type === 'app'
                ? 'App Details'
                : selectedNode?.type === 'channel'
                  ? 'Channel Settings'
                  : 'Properties'
            }}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 hover:bg-muted"
            @click="clearSelection"
          >
            <ILucideX class="size-4" />
          </Button>
        </div>

        <div class="flex-1 overflow-y-auto custom-scrollbar" v-if="selectedNode">
          <div class="p-6 space-y-8">
            <!-- App Editor -->
            <div v-if="selectedNode.type === 'app'" class="space-y-6">
              <div
                class="flex flex-col items-center py-4 bg-muted/20 rounded-xl border border-dashed"
              >
                <img
                  v-if="selectedNode.data.icon_url"
                  :src="selectedNode.data.icon_url"
                  class="size-20 rounded-2xl border shadow-md mb-4"
                />
                <ILucideAppWindow v-else class="size-20 rounded-2xl border bg-muted p-4 mb-4" />
                <h2 class="text-xl font-bold text-center px-4">{{ selectedNode.data.name }}</h2>
                <p class="text-xs text-muted-foreground font-mono mt-1">
                  {{ selectedNode.data.app_id }}
                </p>
              </div>
              <div class="space-y-3">
                <Label class="text-xs font-bold uppercase tracking-widest text-muted-foreground"
                  >Platform</Label
                >
                <div
                  class="flex items-center gap-2 p-3 bg-muted/40 rounded-lg border group hover:border-primary/50 transition-colors"
                >
                  <ILucideSmartphone class="size-4 text-primary" />
                  <span class="text-sm font-medium">{{
                    selectedNode.data.platform || 'Cross-platform'
                  }}</span>
                </div>
              </div>
            </div>

            <!-- Channel Editor -->
            <div v-else-if="selectedNode.type === 'channel'" class="space-y-8">
              <div class="space-y-3">
                <Label class="text-xs font-bold uppercase tracking-widest text-muted-foreground"
                  >Channel Configuration</Label
                >
                <div class="space-y-4">
                  <div class="space-y-2">
                    <span class="text-xs text-muted-foreground ml-1">Name</span>
                    <Input v-model="selectedNode.data.name" class="h-10" />
                  </div>
                </div>
              </div>

              <div class="space-y-4">
                <Label class="text-xs font-bold uppercase tracking-widest text-muted-foreground"
                  >Actions & Integrations</Label
                >

                <div
                  class="group rounded-xl border bg-muted/10 p-4 space-y-4 hover:bg-muted/20 transition-all border-dashed"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 text-sm font-semibold">
                      <ILucideGitBranch class="size-4 text-purple-500" />
                      GitHub Workflow
                    </div>
                    <Badge
                      variant="outline"
                      class="text-[10px] bg-purple-500/10 text-purple-600 border-purple-200"
                      >Beta</Badge
                    >
                  </div>
                  <p class="text-xs text-muted-foreground leading-relaxed">
                    Instantly trigger a new build and deployment from your repository.
                  </p>
                  <Button
                    class="w-full gap-2 shadow-sm font-medium"
                    size="sm"
                    @click="triggerDeployment(selectedNode.id)"
                  >
                    <ILucidePlay class="size-3.5" />
                    Deploy Latest Commit
                  </Button>
                </div>

                <div
                  class="group rounded-xl border bg-muted/10 p-4 space-y-4 hover:bg-muted/20 transition-all border-dashed"
                >
                  <div class="flex items-center gap-2 text-sm font-semibold">
                    <ILucideUploadCloud class="size-4 text-blue-500" />
                    Manual Bundle
                  </div>
                  <Button variant="outline" class="w-full gap-2 font-medium" size="sm">
                    <ILucidePlus class="size-3.5" />
                    Upload New Bundle
                  </Button>
                </div>
              </div>

              <div class="space-y-4">
                <Label class="text-xs font-bold uppercase tracking-widest text-muted-foreground"
                  >Metrics</Label
                >
                <div class="grid grid-cols-2 gap-4">
                  <div class="p-4 border rounded-xl bg-card/50 text-center shadow-sm">
                    <div
                      class="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-bold"
                    >
                      Active Devices
                    </div>
                    <div class="text-2xl font-black text-primary">
                      {{ selectedNode.data.device_count || 0 }}
                    </div>
                  </div>
                  <div class="p-4 border rounded-xl bg-card/50 text-center shadow-sm">
                    <div
                      class="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-bold"
                    >
                      Total Bundles
                    </div>
                    <div class="text-2xl font-black text-blue-500">
                      {{ selectedNode.data.bundle_count || 0 }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="space-y-4 pt-2">
                <div class="flex items-center justify-between px-1">
                  <Label class="text-xs font-bold uppercase tracking-widest text-muted-foreground"
                    >Targeted Users</Label
                  >
                  <span
                    class="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"
                    >Live Connection</span
                  >
                </div>
                <div class="space-y-2.5">
                  <div
                    v-for="i in 3"
                    :key="i"
                    class="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-transparent hover:border-muted-foreground/20 hover:bg-background transition-all"
                  >
                    <div
                      class="size-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    ></div>
                    <div class="flex-1">
                      <div class="font-bold text-xs">User-Hash-{{ i }}7x</div>
                      <div class="text-[10px] text-muted-foreground">Last updated: 2m ago</div>
                    </div>
                    <Badge variant="secondary" class="text-[10px] font-mono font-normal"
                      >v1.2.{{ i }}</Badge
                    >
                  </div>
                </div>
              </div>
            </div>

            <!-- Device Fleet Editor -->
            <div v-else-if="selectedNode.type === 'device'" class="space-y-8">
              <div class="space-y-3">
                <Label class="text-xs font-bold uppercase tracking-widest text-muted-foreground"
                  >Fleet Status</Label
                >
                <div class="p-4 bg-muted/20 rounded-xl border border-dashed text-center">
                  <div class="text-3xl font-black text-primary">
                    {{ formatFleetCount(selectedNode.data.total_count) }}
                  </div>
                  <div class="text-[10px] text-muted-foreground uppercase mt-1">
                    Active Installations
                  </div>
                </div>
              </div>

              <div class="space-y-4">
                <Label class="text-xs font-bold uppercase tracking-widest text-muted-foreground"
                  >Compatibility Check</Label
                >
                <div class="space-y-2">
                  <div
                    class="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20"
                  >
                    <div class="flex items-center gap-2">
                      <ILucideCheckCircle2 class="size-4 text-emerald-500" />
                      <span class="text-xs font-medium">Schema Compatible</span>
                    </div>
                    <Badge
                      variant="outline"
                      class="text-[9px] text-emerald-600 border-emerald-500/30"
                      >Verified</Badge
                    >
                  </div>
                  <div class="p-3 bg-muted/20 rounded-lg text-[10px] text-muted-foreground">
                    This fleet is running on the <strong>{{ activeApp?.platform }}</strong> manifest
                    which matches the current App Root configuration.
                  </div>
                </div>
              </div>
            </div>

            <!-- Default / Debug -->
            <div v-else class="bg-muted/30 p-4 rounded-xl border border-dashed">
              <div class="text-[10px] font-bold mb-3 opacity-50 uppercase tracking-widest">
                Metadata inspector
              </div>
              <pre class="text-[10px] overflow-auto max-h-60 font-mono leading-relaxed">{{
                selectedNode.data
              }}</pre>
            </div>
          </div>
        </div>

        <div class="p-5 border-t bg-muted/5 shrink-0 mt-auto" v-if="selectedNode">
          <Button class="w-full h-11 text-sm font-semibold shadow-md" disabled>
            Save Changes
          </Button>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { VueFlow, useVueFlow, type Node, type Edge } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { onMounted, ref, computed, watch } from 'vue'

import '@vue-flow/minimap/dist/style.css'
import { useAppStore } from '@/stores/app.store'
import { storeToRefs } from 'pinia'
import AppNode from '../nodes/AppNode.vue'
import ChannelNode from '../nodes/ChannelNode.vue'
import BundleNode from '../nodes/BundleNode.vue'
import DeviceFleetNode from '../nodes/DeviceFleetNode.vue'
import GithubNode from '../nodes/GithubNode.vue'
import DataFlowEdge from '../edges/DataFlowEdge.vue'
import PipelineEdge from '../edges/PipelineEdge.vue'

// Styles
import '@vue-flow/core/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const router = useRouter()
const appStore = useAppStore()
const { activeApp } = storeToRefs(appStore)

// Graph State
const elements = ref<(Node | Edge)[]>([])
const isLoading = ref(false)
const isStorming = ref(false)

import dagre from 'dagre'

const {
  onNodeClick,
  onPaneClick,
  onPaneContextMenu,
  onConnect,
  fitView,
  nodes,
  edges,
  addNodes,
  addEdges,
  project,
  removeNodes,
  setNodes,
} = useVueFlow()

onConnect((params) => {
  addEdges([
    {
      ...params,
      type: 'pipeline',
      data: { state: 'idle', label: 'Manual Link' },
    },
  ])
})

// Add Delete key listener
onMounted(() => {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const selectedNodes = nodes.value.filter((n) => n.selected)
      if (selectedNodes.length > 0) {
        removeNodes(selectedNodes)
      }
    }
  })
})

const triggerDeployment = async (channelId: string) => {
  const edgeId = elements.value.find((e) => 'target' in e && e.target === channelId)?.id
  if (!edgeId) return

  isStorming.value = true
  // 1. Start "Deploying" animation on the edge
  elements.value = elements.value.map((el) => {
    if (el.id === edgeId && 'data' in el) {
      return { ...el, data: { ...el.data, state: 'deploying', label: 'Compiling...' } }
    }
    return el
  })

  // 2. Simulate build time
  await new Promise((r) => setTimeout(r, 2000))

  // 3. Complete deployment
  elements.value = elements.value.map((el) => {
    if (el.id === edgeId && 'data' in el) {
      return { ...el, data: { ...el.data, state: 'success', label: 'Deployed v1.2' } }
    }
    if (el.id === channelId && 'data' in el) {
      return { ...el, data: { ...el.data, bundle_count: (el.data.bundle_count || 0) + 1 } }
    }
    return el
  })
  isStorming.value = false
}

const addNode = (type: 'channel' | 'bundle' | 'github' | 'device') => {
  const id = `${type}-${Date.now()}`
  const newNode = {
    id,
    type,
    position: project({ x: 100, y: 100 }),
    data:
      type === 'github'
        ? { branch: 'main' }
        : type === 'device'
          ? {
              name: 'New Device',
              platform: 'native',
              is_online: true,
            }
          : type === 'channel'
            ? {
                name: 'New Channel',
                is_prod: false,
                device_count: 0,
                bundle_count: 0,
              }
            : {
                version_code: '1',
                version_name: '1.0.0',
                size: 0,
              },
  }
  addNodes([newNode])
}

const selectedNode = ref<Node | null>(null)

// Adjust viewport when sidebar opens to avoid obscuring nodes
watch(selectedNode, (newNode) => {
  if (newNode) {
    // Give it a tiny delay to allow sidebar transition to start/finish
    setTimeout(() => {
      fitView({
        padding: 0.3,
        nodes: nodes.value as any,
        duration: 800,
        // We use padding to keep things centered in the remaining space
      })
    }, 100)
  }
})

// Clear selection on background click or right click
onPaneClick(() => {
  selectedNode.value = null
})

onPaneContextMenu(() => {
  selectedNode.value = null
})

onNodeClick(({ node }) => {
  selectedNode.value = node
})

const hasSelection = computed(() => !!selectedNode.value)

const clearSelection = () => {
  selectedNode.value = null
}

const mockFetchChannels = async () => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500))
  return [
    { id: '1', name: 'Production', type: 'public' },
    { id: '2', name: 'Development', type: 'private' },
    { id: '3', name: 'Staging', type: 'public' },
  ]
}

const buildGraph = async () => {
  if (!activeApp.value) return
  isLoading.value = true

  // Try to load saved layout
  const savedLayout = localStorage.getItem(`canvas-layout-${activeApp.value.id}`)
  if (savedLayout) {
    try {
      const { nodes: savedNodes, edges: savedEdges } = JSON.parse(savedLayout)
      elements.value = [...savedNodes, ...savedEdges]
      isLoading.value = false
      return
    } catch (e) {
      console.error('Failed to parse saved layout', e)
    }
  }

  const appId = activeApp.value.id
  const nodes: Node[] = []
  const edges: Edge[] = []

  // 0. GitHub Source Node (Root)
  const githubNodeId = `github-root`
  nodes.push({
    id: githubNodeId,
    type: 'github',
    position: { x: 0, y: -250 },
    data: {
      branch: 'main',
      repo: `${activeApp.value.name.toLowerCase().replace(/ /g, '-')}/repo`,
    },
  })

  // 1. Root App Node
  const appNodeId = `app-${appId}`
  nodes.push({
    id: appNodeId,
    type: 'app',
    position: { x: 0, y: 0 },
    data: {
      name: activeApp.value.name,
      app_id: activeApp.value.app_id,
      icon_url: activeApp.value.icon_url,
      platform: activeApp.value.platform,
      // Schemas for compatibility
      schemas: {
        update_logic: 'semantic_versioning',
        allowed_platforms: [activeApp.value.platform],
      },
    },
  })

  edges.push({
    id: `e-github-app`,
    source: githubNodeId,
    target: appNodeId,
    type: 'pipeline',
    data: { label: 'Repository Sync', state: 'idle' },
  })

  try {
    const channels = await mockFetchChannels()
    const channelY = 300
    const totalWidth = channels.length * 350
    let channelX = -(totalWidth / 2) + 175

    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i]
      const channelNodeId = `channel-${channel?.id}`
      const fleetNodeId = `fleet-${channel?.id}`

      // Channel Node
      nodes.push({
        id: channelNodeId,
        type: 'channel',
        position: { x: channelX, y: channelY },
        data: {
          name: channel?.name,
          is_prod: channel?.type === 'public',
          is_deploying: i === 0,
          is_online: i !== 1,
          bundle_count: Math.floor(Math.random() * 10),
          device_count: Math.floor(Math.random() * 500000),
        },
      })

      // Link App to Channel
      edges.push({
        id: `e-${appNodeId}-${channelNodeId}`,
        source: appNodeId,
        target: channelNodeId,
        type: 'pipeline',
        data: {
          state: i === 0 ? 'deploying' : 'idle',
          duration: i === 0 ? '1.2s' : '4s',
          label: i === 0 ? 'Pushing Build...' : 'Live',
        },
      })

      // Device Fleet Node (Scalability!)
      nodes.push({
        id: fleetNodeId,
        type: 'device',
        position: { x: channelX, y: channelY + 300 },
        data: {
          total_count: Math.floor(Math.random() * 800000) + 100000,
          health_percentage: 95 + Math.floor(Math.random() * 4),
          main_version: `v1.2.${i + 1}`,
        },
      })

      // Link Channel to Fleet
      edges.push({
        id: `e-${channelNodeId}-${fleetNodeId}`,
        source: channelNodeId,
        target: fleetNodeId,
        type: 'flow',
        data: { animated: true, duration: '2s', label: 'Updates' },
      })

      channelX += 350
    }
  } catch (e) {
    console.error('Failed to load graph data', e)
  } finally {
    isLoading.value = false
    elements.value = [...nodes, ...edges]
  }
}

// Initial Data Load
onMounted(() => {
  buildGraph()
})

// Re-build if app changes
watch(activeApp, () => {
  buildGraph()
})

const autoLayout = () => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: 'TB', marginx: 50, marginy: 50, ranksep: 100, nodesep: 80 })

  nodes.value.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 250, height: 150 })
  })

  edges.value.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  const newNodes = nodes.value.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 125,
        y: nodeWithPosition.y - 75,
      },
    }
  })

  setNodes(newNodes)
  fitView({ duration: 800, padding: 0.2 })
}

const saveGraph = () => {
  const layout = {
    nodes: nodes.value.map((n) => ({ id: n.id, position: n.position, data: n.data })),
    edges: edges.value.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      data: e.data,
    })),
  }
  localStorage.setItem(`canvas-layout-${activeApp.value?.id}`, JSON.stringify(layout))
  console.log('Layout saved to LocalStorage')
}

const formatFleetCount = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return num
}
</script>

<style>
/* Override standard styles if needed */
.vue-flow__panel {
  pointer-events: none;
}
.vue-flow__panel > * {
  pointer-events: all;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}
@keyframes deploy-glow {
  0% {
    background: rgba(59, 130, 246, 0.05);
  }
  50% {
    background: rgba(59, 130, 246, 0.15);
  }
  100% {
    background: rgba(59, 130, 246, 0.05);
  }
}

.deploy-storm {
  animation: deploy-glow 2s infinite ease-in-out;
}
</style>
