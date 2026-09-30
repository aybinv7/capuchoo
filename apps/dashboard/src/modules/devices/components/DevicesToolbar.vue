<script setup lang="ts">
import { Map as MapIcon, Search, TableProperties } from "@lucide/vue";
import { watchDebounced } from "@vueuse/core";
import { ref } from "vue";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Channel } from "@/shared/types/release";
import type { DeviceFilters } from "../types/devices.types";

const filters = defineModel<DeviceFilters>({ required: true });
const view = defineModel<"table" | "map">("view", { required: true });

defineProps<{ channels: readonly Channel[]; located: number }>();

const search = ref(filters.value.search);
watchDebounced(
  search,
  (value) => {
    filters.value = { ...filters.value, search: value };
  },
  { debounce: 300 },
);

const ACTIVE_DAYS = new Set(["", "1", "7", "30"]);

function setChannel(value: unknown) {
  filters.value = { ...filters.value, channelId: typeof value === "string" ? value : "" };
}

function setActiveDays(value: unknown) {
  const days = String(value ?? "");
  if (ACTIVE_DAYS.has(days))
    filters.value = { ...filters.value, activeDays: days as DeviceFilters["activeDays"] };
}

function setView(value: unknown) {
  if (value === "table" || value === "map") view.value = value;
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <InputGroup class="w-72">
      <InputGroupAddon><Search /></InputGroupAddon>
      <InputGroupInput
        v-model="search"
        placeholder="Device id, custom id, model, name"
        aria-label="Search devices"
      />
    </InputGroup>
    <NativeSelect
      :model-value="filters.channelId"
      class="h-9 w-48"
      aria-label="Channel"
      @update:model-value="setChannel"
    >
      <NativeSelectOption value="">All channels</NativeSelectOption>
      <NativeSelectOption v-for="channel in channels" :key="channel.id" :value="channel.id">{{
        channel.name
      }}</NativeSelectOption>
    </NativeSelect>
    <NativeSelect
      :model-value="filters.activeDays"
      class="h-9 w-40"
      aria-label="Last seen"
      @update:model-value="setActiveDays"
    >
      <NativeSelectOption value="">Any time</NativeSelectOption>
      <NativeSelectOption value="1">Seen in 24h</NativeSelectOption>
      <NativeSelectOption value="7">Seen in 7 days</NativeSelectOption>
      <NativeSelectOption value="30">Seen in 30 days</NativeSelectOption>
    </NativeSelect>
    <ToggleGroup
      :model-value="view"
      type="single"
      variant="outline"
      size="sm"
      class="ml-auto"
      @update:model-value="setView"
    >
      <ToggleGroupItem value="table" aria-label="Table">
        <TableProperties />
        Table
      </ToggleGroupItem>
      <ToggleGroupItem
        value="map"
        aria-label="Map"
        :disabled="located === 0"
        :title="located === 0 ? 'No loaded device has reported a location' : undefined"
      >
        <MapIcon />
        Map
        <span class="text-muted-foreground font-mono text-[10px]">{{ located }}</span>
      </ToggleGroupItem>
    </ToggleGroup>
  </div>
</template>
