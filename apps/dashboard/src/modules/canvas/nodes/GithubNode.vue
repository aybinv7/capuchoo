<template>
  <div
    class="relative flex min-w-[200px] flex-col overflow-hidden rounded-xl border bg-background shadow-lg transition-all hover:shadow-xl hover:ring-2 hover:ring-purple-500/20"
    :class="{ 'ring-2 ring-purple-600': selected }"
  >
    <Handle type="source" :position="Position.Bottom" class="bg-purple-600! size-3!" />

    <div class="flex items-center gap-3 p-3 bg-purple-500/10 border-b border-purple-200/50">
      <div class="p-2 rounded-lg bg-purple-600 text-white shadow-md">
        <ILucideGithub class="size-5" />
      </div>
      <div class="flex flex-col">
        <span class="text-sm font-bold">Source Repository</span>
        <span class="text-[10px] uppercase tracking-widest text-purple-600 font-black"
          >Main Branch</span
        >
      </div>
    </div>

    <div class="p-4 space-y-3 bg-background/50">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div
            class="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          ></div>
          <span class="text-[11px] font-medium">Synced</span>
        </div>
        <Badge variant="secondary" class="text-[9px] font-mono">v1.4.2</Badge>
      </div>

      <div class="p-2 rounded-lg bg-muted/30 border border-dashed text-[10px] space-y-1">
        <div class="font-bold flex items-center gap-1">
          <ILucideGitCommit class="size-3" />
          feat: analytics engine
        </div>
        <div class="text-muted-foreground">committed 12m ago • @alex</div>
      </div>
    </div>

    <div class="p-2 px-3 border-t bg-purple-500/5">
      <Button
        variant="ghost"
        size="sm"
        class="w-full h-7 text-[10px] gap-2 hover:bg-purple-500/10 text-purple-700"
      >
        <ILucideRefreshCw class="size-3" />
        Pull Latest
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  data: {
    repo?: string
    branch?: string
    last_commit?: string
  }
  selected?: boolean
}>()
</script>
