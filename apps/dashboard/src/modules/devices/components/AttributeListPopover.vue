<script setup lang="ts">
import { Copy, Search } from "@lucide/vue";
import { computed, ref } from "vue";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { useCopyToast } from "@/shared/composables/useCopyToast";
import type { AttributeEntry } from "@/shared/devices/lib/device-attributes";

const props = defineProps<{
  entries: readonly AttributeEntry[];
  hidden: number;
  updatedAt: string | null;
}>();

const SEARCH_FROM = 8;

const query = ref("");
const { copyText } = useCopyToast();

const searchable = computed(() => props.entries.length > SEARCH_FROM);
const shown = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return props.entries;
  return props.entries.filter(
    (entry) =>
      entry.key.toLowerCase().includes(needle) || entry.value.toLowerCase().includes(needle),
  );
});

function reset(open: boolean) {
  if (!open) query.value = "";
}
</script>

<template>
  <Popover @update:open="reset">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="bg-surface hover:bg-accent focus-visible:ring-ring/50 text-muted-foreground hover:text-foreground inline-flex h-6 items-center rounded-md border px-2 font-mono text-xs tabular transition-colors outline-none focus-visible:ring-3"
        :aria-label="`Show all ${props.entries.length} attributes, ${props.hidden} more`"
      >
        +{{ props.hidden }}
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" class="w-80 p-0">
      <header class="flex items-baseline justify-between gap-2 border-b px-3 py-2 text-xs">
        <span class="font-medium">{{ props.entries.length }} attributes</span>
        <span v-if="props.updatedAt" class="text-muted-foreground">
          set <RelativeTime :value="props.updatedAt" />
        </span>
      </header>
      <div v-if="searchable" class="border-b p-2">
        <InputGroup class="h-8">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            v-model="query"
            placeholder="Filter attributes"
            aria-label="Filter attributes"
          />
        </InputGroup>
      </div>
      <ul class="max-h-72 overflow-y-auto p-1" aria-label="Attributes">
        <li v-for="entry in shown" :key="entry.key">
          <button
            type="button"
            class="group/row hover:bg-accent focus-visible:bg-accent flex w-full cursor-copy items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none"
            :aria-label="`Copy ${entry.key}: ${entry.value}`"
            @click="copyText(entry.value, entry.key)"
          >
            <span
              class="text-muted-foreground w-28 shrink-0 truncate font-mono"
              :title="entry.key"
              >{{ entry.key }}</span
            >
            <span class="min-w-0 flex-1 font-mono break-words">{{ entry.value }}</span>
            <Copy
              class="text-muted-foreground mt-0.5 size-3 shrink-0 opacity-0 group-hover/row:opacity-100 group-focus-visible/row:opacity-100"
              aria-hidden="true"
            />
          </button>
        </li>
        <li v-if="!shown.length" class="text-muted-foreground px-2 py-4 text-center text-xs">
          No attribute matches “{{ query }}”.
        </li>
      </ul>
    </PopoverContent>
  </Popover>
</template>
