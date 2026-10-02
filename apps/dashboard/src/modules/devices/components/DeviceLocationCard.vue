<script setup lang="ts">
import { MapPin } from "@lucide/vue";
import { computed, defineAsyncComponent } from "vue";
import CopyButton from "@/shared/components/CopyButton.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";

const DeviceLocationMap = defineAsyncComponent(() => import("./DeviceLocationMap.vue"));

const props = defineProps<{
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  reportedAt: string | null;
}>();

const located = computed(
  () => typeof props.latitude === "number" && typeof props.longitude === "number",
);
const coordinates = computed(() =>
  located.value ? `${props.latitude!.toFixed(5)}, ${props.longitude!.toFixed(5)}` : "",
);
</script>

<template>
  <section class="bg-card min-w-0 overflow-hidden rounded-lg border">
    <header
      class="text-muted-foreground flex items-center gap-2 border-b px-4 py-2.5 text-xs font-medium uppercase"
    >
      <MapPin class="size-3.5" />
      Location
    </header>
    <template v-if="located">
      <div class="bg-muted/40 h-52">
        <DeviceLocationMap
          :latitude="props.latitude!"
          :longitude="props.longitude!"
          :accuracy="props.accuracy"
        />
      </div>
      <div class="flex items-center justify-between gap-2 border-t px-4 py-2 text-xs">
        <div class="text-muted-foreground min-w-0">
          <span class="text-foreground">{{
            props.accuracy ? `±${Math.round(props.accuracy)} m` : "accuracy unknown"
          }}</span>
          <template v-if="props.reportedAt">
            · reported <RelativeTime :value="props.reportedAt" />
          </template>
        </div>
        <span class="flex items-center gap-0.5">
          <span class="text-muted-foreground font-mono text-[11px] tabular">{{ coordinates }}</span>
          <CopyButton :value="coordinates" label="coordinates" />
        </span>
      </div>
    </template>
    <p v-else class="text-muted-foreground px-4 py-6 text-sm">No location reported.</p>
  </section>
</template>
