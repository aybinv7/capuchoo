<template>
  <div
    class="relative flex min-w-[200px] flex-col overflow-hidden rounded-xl border bg-background shadow-sm transition-all hover:shadow-md hover:ring-2 hover:ring-primary/20"
    :class="{ 'ring-2 ring-primary': selected }"
  >
    <Handle type="target" :position="Position.Top" class="bg-muted-foreground! size-3!" />
    <Handle type="source" :position="Position.Bottom" class="bg-primary! size-3!" />

    <div
      class="flex items-center gap-3 p-3 border-b"
      :class="isProd ? 'bg-orange-500/10' : 'bg-blue-500/10'"
    >
      <div
        class="p-2 rounded-md relative"
        :class="isProd ? 'bg-orange-500/20 text-orange-600' : 'bg-blue-500/20 text-blue-600'"
      >
        <ILucideRadio class="size-5" />
        <div
          v-if="data.is_deploying"
          class="absolute -top-1 -right-1 size-2.5 rounded-full bg-primary animate-pulse border-2 border-background"
        ></div>
      </div>
      <div class="flex flex-col flex-1">
        <div class="flex items-center justify-between">
          <span class="font-semibold text-sm">{{ data.name }}</span>
          <div
            class="size-1.5 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]"
            :class="data.is_online !== false ? 'bg-green-500' : 'bg-red-500'"
          ></div>
        </div>
        <span class="text-[10px] uppercase tracking-wider font-bold opacity-70">{{
          isProd ? 'Production' : 'Development'
        }}</span>
      </div>
    </div>

    <div class="p-2 space-y-1 bg-background">
      <div class="flex justify-between text-xs">
        <span class="text-muted-foreground">Bundles</span>
        <span class="font-medium">{{ data.bundle_count || 0 }}</span>
      </div>
      <div class="flex justify-between text-xs">
        <span class="text-muted-foreground">Devices</span>
        <span class="font-medium">{{ data.device_count || 0 }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { computed } from 'vue'

const props = defineProps<{
  data: {
    name: string
    is_prod?: boolean
    is_deploying?: boolean
    is_online?: boolean
    bundle_count?: number
    device_count?: number
  }
  selected?: boolean
}>()

const isProd = computed(() => props.data.name.toLowerCase().includes('prod') || props.data.is_prod)
</script>
