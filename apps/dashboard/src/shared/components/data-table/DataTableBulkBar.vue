<script setup lang="ts">
import { Download, X } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/shared/lib/format";

const props = defineProps<{ count: number; exportable: boolean }>();
const emit = defineEmits<{ clear: []; export: [] }>();
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="-translate-y-1 opacity-0"
    leave-active-class="transition duration-100 ease-in"
    leave-to-class="-translate-y-1 opacity-0"
  >
    <div
      v-if="props.count > 0"
      class="bg-muted/60 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5"
      role="status"
    >
      <span class="text-sm font-medium tabular">{{ formatCount(props.count, true) }} selected</span>
      <Button variant="ghost" size="xs" @click="emit('clear')">
        <X />
        Clear
      </Button>
      <div class="ml-auto flex items-center gap-2">
        <slot />
        <Button v-if="props.exportable" variant="outline" size="xs" @click="emit('export')">
          <Download />
          Export CSV
        </Button>
      </div>
    </div>
  </Transition>
</template>
