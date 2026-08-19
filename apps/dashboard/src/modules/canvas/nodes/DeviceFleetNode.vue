<template>
  <div
    class="relative flex min-w-[220px] flex-col overflow-hidden rounded-xl border bg-background shadow-lg transition-all hover:shadow-xl hover:ring-2 hover:ring-blue-500/20"
    :class="{ 'ring-2 ring-blue-600': selected }"
  >
    <Handle type="target" :position="Position.Top" class="bg-muted-foreground! size-3!" />

    <div class="flex items-center gap-3 p-3 bg-blue-500/10 border-b border-blue-200/50">
      <div class="p-2 rounded-lg bg-blue-600 text-white shadow-md relative">
        <ILucideSmartphone class="size-5" />
        <div
          class="absolute -bottom-1 -right-1 size-2 rounded-full bg-emerald-500 border border-white animate-pulse"
        ></div>
      </div>
      <div class="flex flex-col">
        <span class="text-sm font-bold">Device Fleet</span>
        <span class="text-[10px] uppercase tracking-widest text-blue-600 font-black"
          >Live Cluster</span
        >
      </div>
    </div>

    <div class="p-4 space-y-4 bg-background/50">
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1">
          <div class="text-[9px] text-muted-foreground uppercase font-bold">Total Nodes</div>
          <div class="text-xl font-black">{{ formatCount(data.total_count) }}</div>
        </div>
        <div class="space-y-1">
          <div class="text-[9px] text-muted-foreground uppercase font-bold">Healthy</div>
          <div class="text-xl font-black text-emerald-500">{{ data.health_percentage }}%</div>
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex justify-between text-[10px] font-bold">
          <span>Version Distribution</span>
          <span class="text-primary">{{ data.main_version }}</span>
        </div>
        <div class="flex h-1.5 w-full rounded-full bg-muted overflow-hidden gap-0.5">
          <div class="h-full bg-primary" :style="{ width: '70%' }"></div>
          <div class="h-full bg-blue-400" :style="{ width: '20%' }"></div>
          <div class="h-full bg-muted-foreground/30" :style="{ width: '10%' }"></div>
        </div>
      </div>
    </div>

    <div class="p-2 px-3 border-t bg-blue-500/5 flex justify-between items-center">
      <div class="flex -space-x-2">
        <div
          v-for="i in 3"
          :key="i"
          class="size-5 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[8px] font-bold"
        >
          {{ ['A', 'B', 'C'][i - 1] }}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="h-6 text-[9px] gap-1 hover:bg-blue-500/10 text-blue-700"
      >
        Manage Fleet
        <ILucideChevronRight class="size-3" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  data: {
    total_count: number
    health_percentage: number
    main_version: string
  }
  selected?: boolean
}>()

const formatCount = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return num
}
</script>
