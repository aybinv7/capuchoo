<script setup lang="ts">
import { Plus } from "@lucide/vue";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CopyButton from "@/shared/components/CopyButton.vue";

const SNIPPET = `import { setDeviceAttributes } from "@capuchoo/updater";

await setDeviceAttributes({ employeeId: "E-1042", route: "Oran West" });`;
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground hover:border-ring/50 focus-visible:ring-ring/50 inline-flex h-6 items-center gap-1 rounded-md border border-dashed px-2 text-xs transition-colors outline-none focus-visible:ring-3"
      >
        <Plus class="size-3" />
        No attributes
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" class="w-96 max-w-[calc(100vw-2rem)] space-y-3 p-3">
      <p class="text-xs text-pretty">
        <span class="font-medium">Tell testers whose device this is.</span>
        <span class="text-muted-foreground">
          Set attributes from the app; they show here and are searchable from the devices
          list.</span
        >
      </p>
      <div class="bg-surface relative rounded-md border">
        <pre
          class="overflow-x-auto px-3 py-2.5 pr-10 font-mono text-[11px] leading-relaxed"
        ><code>{{ SNIPPET }}</code></pre>
        <CopyButton :value="SNIPPET" label="snippet" class="absolute top-1.5 right-1.5" />
      </div>
    </PopoverContent>
  </Popover>
</template>
