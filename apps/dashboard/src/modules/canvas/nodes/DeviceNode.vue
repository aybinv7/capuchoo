<template>
  <div
    class="relative flex min-w-[140px] flex-col overflow-hidden rounded-lg border bg-background shadow-sm transition-all hover:shadow-md hover:ring-2 hover:ring-primary/20"
    :class="{ 'ring-2 ring-primary': selected }"
  >
    <Handle type="target" :position="Position.Top" class="bg-muted-foreground! size-3!" />

    <div class="flex items-center gap-2 p-2 border-b bg-muted/10">
      <div class="relative">
        <div
          class="size-2 rounded-full"
          :class="data.is_online ? 'bg-green-500' : 'bg-gray-300'"
        ></div>
        <div
          v-if="data.is_online"
          class="absolute inset-0 size-2 rounded-full bg-green-500 animate-ping opacity-75"
        ></div>
      </div>
      <span class="text-xs font-medium truncate flex-1">{{ data.name || 'Unknown Device' }}</span>
      <ILucideMonitor v-if="data.platform === 'web'" class="size-3 text-muted-foreground" />
      <ILucideSmartphone v-else class="size-3 text-muted-foreground" />
    </div>

    <div class="p-2 text-[10px] text-muted-foreground bg-background space-y-0.5">
      <div class="flex items-center gap-1">
        <ILucideSmartphone class="size-3" />
        <span class="truncate">{{ data.platform }} {{ data.os_version }}</span>
      </div>
      <div class="truncate opacity-70">App v{{ data.app_version }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  data: {
    name: string
    platform: string
    os_version: string
    app_version: string
    is_online: boolean
  }
  selected?: boolean
}>()
</script>
