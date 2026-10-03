<script setup lang="ts">
import { Plus } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { refDebounced } from "@vueuse/core";
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchDevices, type DeviceOption } from "../../services/recordings.service";

const props = defineProps<{ appId: string }>();
const emit = defineEmits<{ pick: [device: DeviceOption] }>();

const open = ref(false);
const search = ref("");
const debounced = refDebounced(search, 250);
const results = useQuery({
  queryKey: computed(() => ["recording-device-search", props.appId, debounced.value] as const),
  queryFn: ({ signal }) => searchDevices(props.appId, debounced.value, signal),
  enabled: open,
  staleTime: 30_000,
});

function pick(device: DeviceOption) {
  open.value = false;
  search.value = "";
  emit("pick", device);
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="ghost" size="xs" class="text-muted-foreground">
        <Plus />
        Add a device
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-80 p-0" align="start">
      <Command :ignore-filter="true">
        <CommandInput v-model="search" placeholder="Custom id, model or device id" />
        <CommandList>
          <CommandEmpty>{{
            results.isFetching.value ? "Searching…" : "No device found."
          }}</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-for="device in results.data.value ?? []"
              :key="device.id"
              :value="device.id"
              @select="pick(device)"
            >
              <div class="min-w-0">
                <div class="truncate text-sm">{{ device.label }}</div>
                <div class="text-muted-foreground truncate text-xs">{{ device.detail }}</div>
              </div>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
