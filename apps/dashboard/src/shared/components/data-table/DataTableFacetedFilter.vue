<script setup lang="ts" generic="T">
import { Check, CirclePlus } from "@lucide/vue";
import type { Column } from "@tanstack/vue-table";
import { computed } from "vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { cellText } from "./lib/filter-fns";
import type { DataTableFacet, FacetOption } from "./types";

const props = defineProps<{ column: Column<T, unknown>; facet: DataTableFacet; counts: boolean }>();

const selected = computed(() => {
  const value = props.column.getFilterValue();
  return new Set(Array.isArray(value) ? value.map(cellText) : []);
});

const facetCounts = computed(() =>
  props.counts ? props.column.getFacetedUniqueValues() : new Map<unknown, number>(),
);

const options = computed<readonly FacetOption[]>(() => {
  if (props.facet.options) return props.facet.options;
  const label = props.column.columnDef.meta?.facetLabel;
  return [...facetCounts.value.keys()]
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => ({ value: cellText(value), label: label ? label(value) : cellText(value) }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

const countsByValue = computed(() => {
  const counts = new Map<string, number>();
  for (const [key, count] of facetCounts.value) counts.set(cellText(key), count);
  return counts;
});

const countOf = (value: string) => countsByValue.value.get(value);

const labels = computed(() =>
  options.value.filter((option) => selected.value.has(option.value)).map((option) => option.label),
);

function toggle(value: string) {
  if (props.facet.single) {
    props.column.setFilterValue(selected.value.has(value) ? undefined : [value]);
    return;
  }
  const next = new Set(selected.value);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  props.column.setFilterValue(next.size > 0 ? [...next] : undefined);
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="outline" size="sm" class="h-8 border-dashed">
        <CirclePlus />
        {{ props.facet.title }}
        <template v-if="selected.size > 0">
          <Separator orientation="vertical" class="mx-1 data-[orientation=vertical]:h-4" />
          <Badge variant="secondary" class="rounded-sm px-1 font-normal lg:hidden">{{
            selected.size
          }}</Badge>
          <div class="hidden gap-1 lg:flex">
            <Badge v-if="selected.size > 2" variant="secondary" class="rounded-sm px-1 font-normal"
              >{{ selected.size }} selected</Badge
            >
            <template v-else>
              <Badge
                v-for="label in labels"
                :key="label"
                variant="secondary"
                class="max-w-32 truncate rounded-sm px-1 font-normal"
                >{{ label }}</Badge
              >
            </template>
          </div>
        </template>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-60 p-0" align="start">
      <Command>
        <CommandInput :placeholder="props.facet.title" class="h-9" />
        <CommandList class="max-h-72">
          <CommandEmpty>No value matches.</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-for="option in options"
              :key="option.value"
              :value="option.value"
              class="py-1.5"
              @select.prevent="toggle(option.value)"
            >
              <span
                :class="
                  cn(
                    'border-primary flex size-4 shrink-0 items-center justify-center border',
                    props.facet.single ? 'rounded-full' : 'rounded-sm',
                    selected.has(option.value)
                      ? 'bg-primary text-primary-foreground'
                      : 'opacity-50 [&_svg]:invisible',
                  )
                "
              >
                <Check class="size-3 text-current" />
              </span>
              <component :is="option.icon" v-if="option.icon" class="size-4" />
              <span class="truncate">{{ option.label }}</span>
              <span
                v-if="countOf(option.value) !== undefined"
                class="text-muted-foreground ml-auto font-mono text-xs tabular"
                >{{ countOf(option.value) }}</span
              >
            </CommandItem>
          </CommandGroup>
          <template v-if="selected.size > 0">
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__clear"
                class="justify-center py-1.5"
                @select="props.column.setFilterValue(undefined)"
                >Clear filter</CommandItem
              >
            </CommandGroup>
          </template>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
