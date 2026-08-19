<template>
  <div
    class="relative flex min-w-[180px] flex-col overflow-hidden rounded-xl border bg-background shadow-sm transition-all hover:shadow-md hover:ring-2 hover:ring-primary/20"
    :class="{ 'ring-2 ring-primary': selected }"
  >
    <!-- Handle for connections (targets/sources) -->
    <Handle type="target" :position="Position.Top" class="bg-muted-foreground! size-3!" />
    <Handle type="source" :position="Position.Bottom" class="bg-primary! size-3!" />

    <!-- Node Content -->
    <div class="flex flex-col">
      <div class="flex items-center gap-3 p-3 bg-muted/20 border-b">
        <div
          class="flex size-10 items-center justify-center rounded-lg bg-background border shadow-sm"
        >
          <img v-if="data.icon_url" :src="data.icon_url" class="size-8 rounded-md object-cover" />
          <ILucideAppWindow v-else class="size-6 text-foreground" />
        </div>
        <div class="flex flex-col overflow-hidden">
          <span class="text-sm font-semibold truncate">{{ data.name }}</span>
          <span class="text-xs text-muted-foreground truncate font-mono">{{
            data.app_id || 'no-id'
          }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 px-3 py-2 border-b bg-muted/10">
        <div class="flex items-center gap-1.5 flex-1">
          <div
            class="size-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
          ></div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
            >Application</span
          >
        </div>
        <Badge variant="outline" class="text-[9px] font-mono py-0 h-4">ROOT</Badge>
      </div>
    </div>

    <!-- Stats / Footer -->
    <div
      class="p-2 flex items-center justify-between text-[10px] text-muted-foreground bg-background"
    >
      <div class="flex items-center gap-1.5">
        <ILucideSmartphone class="size-3" />
        <span class="capitalize">{{ data.platform || 'native' }}</span>
      </div>
      <div class="flex items-center gap-1.5 overflow-hidden">
        <ILucideShieldCheck class="size-3 text-primary" />
        <span class="truncate">Verified</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  data: {
    name: string
    app_id: string
    icon_url?: string
    platform?: string
  }
  selected?: boolean
}>()
</script>
