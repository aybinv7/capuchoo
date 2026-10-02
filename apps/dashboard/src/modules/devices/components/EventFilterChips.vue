<script setup lang="ts">
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EVENT_FILTERS, isEventFilter } from "../lib/event-filters";
import type { EventFilter } from "../types/devices.types";

const filter = defineModel<EventFilter>({ required: true });

function select(value: unknown) {
  if (typeof value === "string" && isEventFilter(value)) filter.value = value;
}
</script>

<template>
  <ToggleGroup
    :model-value="filter"
    type="single"
    variant="outline"
    size="sm"
    aria-label="Event category"
    class="flex-wrap"
    @update:model-value="select"
  >
    <ToggleGroupItem
      v-for="option in EVENT_FILTERS"
      :key="option.value"
      :value="option.value"
      class="text-xs"
      >{{ option.label }}</ToggleGroupItem
    >
  </ToggleGroup>
</template>
