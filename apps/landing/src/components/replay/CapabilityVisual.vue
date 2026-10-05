<script setup lang="ts">
import { MousePointer2, Pointer } from "@lucide/vue";
import { EXPORTED_TEST, type Capability } from "@/content/replay";

const props = defineProps<{ id: Capability["id"] }>();
</script>

<template>
  <div aria-hidden="true" class="bg-muted/50 relative h-44 overflow-hidden rounded-xl border">
    <template v-if="props.id === 'assist'">
      <div
        class="bg-background absolute top-4 left-1/2 h-60 w-44 -translate-x-1/2 rounded-[20px] border-[5px] border-[oklch(0.3_0.01_100)] px-2.5 pt-2"
      >
        <div
          class="bg-destructive mx-auto flex w-fit items-center gap-1.5 rounded-full py-0.5 pr-0.5 pl-2 text-[8px] leading-none font-semibold whitespace-nowrap text-white"
        >
          <span class="size-1 rounded-full bg-white" />
          Karim is using the app
          <span class="text-destructive rounded-full bg-white px-1.5 py-0.5">Stop</span>
        </div>
        <div class="mt-3 space-y-2">
          <span class="bg-muted block h-6 rounded-md" />
          <span class="bg-muted block h-6 rounded-md" />
          <span class="bg-primary/25 block h-6 rounded-md" />
        </div>
      </div>
      <div class="absolute top-[58%] left-[58%] flex items-start">
        <MousePointer2 class="fill-primary text-background size-5 drop-shadow" />
        <span
          class="bg-primary mt-4 -ml-1 rounded-full px-1.5 text-[9px] leading-4 font-semibold text-white"
          >Karim</span
        >
      </div>
      <div class="absolute top-[34%] left-[33%] flex items-start">
        <Pointer class="fill-info text-background size-5 drop-shadow" />
        <span
          class="bg-info mt-4 -ml-1 rounded-full px-1.5 text-[9px] leading-4 font-semibold text-white"
          >User</span
        >
      </div>
    </template>

    <div v-else-if="props.id === 'errors'" class="space-y-3 p-4">
      <div class="bg-background flex items-center gap-2 rounded-lg border px-2.5 py-2">
        <span class="bg-destructive size-1.5 shrink-0 rounded-full" />
        <span class="truncate font-mono text-[11px] font-semibold">TypeError: reading 'lines'</span>
        <span class="bg-destructive ml-auto shrink-0 rounded px-1 text-[9px] font-medium text-white"
          >Regressed</span
        >
      </div>
      <div class="space-y-1.5 px-1">
        <div class="flex items-center gap-2 text-[11px]">
          <span class="w-12 font-mono">1.9.2</span>
          <span class="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
            ><span class="bg-destructive block h-full w-[42%] rounded-full"
          /></span>
          <span class="text-destructive w-8 text-right font-medium">42%</span>
        </div>
        <div class="flex items-center gap-2 text-[11px]">
          <span class="w-12 font-mono">1.9.1</span>
          <span class="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
            ><span class="bg-warning block h-full w-[11%] rounded-full"
          /></span>
          <span class="w-8 text-right">11%</span>
        </div>
        <div class="flex items-center gap-2 text-[11px]">
          <span class="w-12 font-mono">1.9.0</span>
          <span class="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
            ><span class="bg-warning block h-full w-[9%] rounded-full"
          /></span>
          <span class="w-8 text-right">9%</span>
        </div>
      </div>
      <p class="text-muted-foreground px-1 text-[10px]">sessions with errors, by version</p>
    </div>

    <pre
      v-else
      class="text-foreground/90 h-full overflow-hidden p-4 font-mono text-[10.5px] leading-[1.7]"
    ><code>{{ EXPORTED_TEST }}</code></pre>
  </div>
</template>
