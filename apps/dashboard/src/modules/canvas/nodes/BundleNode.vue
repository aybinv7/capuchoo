<template>
  <div
    class="relative flex min-w-[160px] flex-col overflow-hidden rounded-lg border bg-background shadow-sm transition-all hover:shadow-md hover:ring-2 hover:ring-primary/20"
    :class="{ 'ring-2 ring-primary': selected }"
  >
    <Handle type="target" :position="Position.Top" class="bg-muted-foreground! size-3!" />
    <!-- Bundles usually don't have sources unless we link to specific devices? Keeping source for now -->
    <Handle type="source" :position="Position.Bottom" class="bg-primary! size-3!" />

    <div class="flex items-center gap-3 p-2 border-b bg-muted/20">
      <div class="p-1.5 rounded-md bg-primary/10 text-primary">
        <ILucidePackage class="size-3.5" />
      </div>
      <div class="flex flex-col flex-1 overflow-hidden">
        <span class="font-mono text-[10px] font-bold leading-tight">v{{ data.version_code }}</span>
        <span class="text-[9px] text-muted-foreground truncate">{{ data.version_name }}</span>
      </div>
      <Badge
        v-if="data.is_latest"
        variant="default"
        class="text-[8px] px-1 h-3 bg-emerald-500 hover:bg-emerald-600 border-none"
        >Latest</Badge
      >
    </div>

    <div class="p-2 space-y-1.5 bg-background">
      <div class="flex items-center justify-between text-[10px]">
        <span class="text-muted-foreground">Payload</span>
        <span class="font-medium text-foreground">{{ formatSize(data.size || 0) }}</span>
      </div>
      <div class="w-full h-1 bg-muted rounded-full overflow-hidden">
        <div class="h-full bg-primary/40" :style="{ width: '100%' }"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  data: {
    version_code: string
    version_name: string
    size?: number
    is_latest?: boolean
  }
  selected?: boolean
}>()

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>
