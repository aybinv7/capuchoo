<template>
  <div class="relative w-full h-[600px] rounded-lg overflow-hidden border shadow-sm group">
    <!--
      Honest about having nothing to show. Until devices report real GPS
      coordinates, this is empty rather than populated with the fabricated
      points it used to show for every device.
    -->
    <div
      v-if="devicesWithoutLocation > 0"
      class="absolute bottom-4 left-4 z-[400] bg-background/95 backdrop-blur-md px-3 py-1.5 rounded-lg border text-xs text-muted-foreground shadow"
    >
      {{ devicesWithoutLocation }} device{{ devicesWithoutLocation === 1 ? "" : "s" }} with no
      reported location, not shown
    </div>
    <l-map
      ref="map"
      v-model:zoom="zoom"
      v-model:center="center"
      :use-global-leaflet="false"
      :options="mapOptions"
      class="z-0"
    >
      <l-tile-layer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        layer-type="base"
        name="CartoDB Dark Matter"
        :no-wrap="true"
        attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> &copy; <a href='https://carto.com/attributions'>CARTO</a>"
      />

      <l-marker
        v-for="device in mapDevices"
        :key="device.id"
        :lat-lng="[device.latitude, device.longitude]"
      >
        <l-icon class-name="custom-marker-icon">
          <div class="relative">
            <div
              class="h-3 w-3 rounded-full border-2 border-background"
              :class="getStatusColor(device)"
            ></div>
            <div
              class="absolute -top-1 -left-1 h-5 w-5 rounded-full opacity-20 animate-pulse"
              :class="getStatusColor(device)"
            ></div>
          </div>
        </l-icon>
        <l-popup>
          <div class="space-y-2 min-w-[200px]">
            <div class="flex items-center justify-between">
              <h4 class="font-bold text-sm">{{ device.device_id }}</h4>
              <Badge variant="outline" class="text-[10px] h-5">{{ device.platform }}</Badge>
            </div>
            <div class="text-xs text-muted-foreground space-y-1">
              <!-- current_bundle_id is declared on the type and never returned by the
                   API - see devices.types.ts. version_name is the field that is
                   actually populated: the applied OTA bundle, or "builtin". -->
              <div>Version: {{ device.version_name || "builtin" }}</div>
              <div>Last Seen: {{ formatDate(device.last_check) }}</div>
              <div>State: {{ device.custom_channel || device.channel || "Standard" }}</div>
            </div>
            <div class="border-t pt-2 flex gap-2">
              <Button size="sm" variant="default" class="w-full" @click="openDeviceDetail(device)">
                View
              </Button>
            </div>
          </div>
        </l-popup>
      </l-marker>
    </l-map>

    <!-- Map Controls / Filters Overlay -->
    <div
      v-if="showControls"
      class="absolute top-4 right-4 z-[400] bg-background/95 backdrop-blur-md p-3 rounded-lg border shadow-xl space-y-3 transition-opacity duration-200"
    >
      <h5 class="text-xs font-semibold px-2 flex items-center gap-2">
        <i-lucide-filter class="w-3 h-3" />
        Filters
      </h5>
      <div class="flex flex-col gap-1">
        <Button
          v-for="opt in filterOptions"
          :key="opt.value"
          variant="ghost"
          size="sm"
          class="justify-start h-8 text-xs font-medium"
          :class="{ 'bg-accent text-accent-foreground': filter === opt.value }"
          @click="filter = opt.value"
        >
          <div
            v-if="opt.color"
            class="h-2 w-2 rounded-full mr-2 shadow-sm"
            :class="opt.color"
          ></div>
          <span v-else class="mr-2">🌍</span>
          {{ opt.label }}
        </Button>
      </div>

      <Separator class="my-2" />

      <h5 class="text-xs font-semibold px-2 flex items-center gap-2">
        <i-lucide-navigation class="w-3 h-3" />
        Quick Fly
      </h5>
      <div class="grid grid-cols-2 gap-1">
        <Button
          v-for="city in algeriaCities"
          :key="city.name"
          variant="outline"
          size="icon"
          class="h-8 w-full text-[10px]"
          title="Fly to city"
          @click="flyTo(city.coords)"
        >
          {{ city.name }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import "leaflet/dist/leaflet.css";
import { LMap, LTileLayer, LMarker, LPopup, LIcon } from "@vue-leaflet/vue-leaflet";
import type { Device } from "@/modules/devices/types/devices.types";

const { items, showControls } = defineProps<{
  items: Device[];
  showControls?: boolean;
}>();

const router = useRouter();
const zoom = ref(5);
const center = ref<[number, number]>([28.0, 3.0]);
const filter = ref<"all" | "active" | "stale">("all");

const mapOptions = {
  minZoom: 5,
  maxZoom: 20,
  maxBounds: [
    [18.0, -7.0],
    [38.0, 10.0],
  ],
  maxBoundsViscosity: 1.0,
  zoomControl: false,
};

const filterOptions = [
  { value: "all", label: "All Devices", color: "" },
  { value: "active", label: "Active", color: "bg-green-500" },
  { value: "stale", label: "Stale", color: "bg-slate-400" },
] as const;

const algeriaCities = [
  { name: "Algiers", coords: [36.75, 3.05] },
  { name: "Oran", coords: [35.69, -0.63] },
  { name: "Constantine", coords: [36.36, 6.61] },
  { name: "Ouargla", coords: [31.95, 5.32] },
];

const flyTo = (coords: number[]) => {
  center.value = coords as [number, number];
  zoom.value = 10;
};

/**
 * A device counts as active if it has checked in recently. Same threshold as
 * the single-device page's own health card, so the two screens cannot
 * disagree about what "active" means.
 */
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const isStale = (d: Device): boolean => {
  if (!d.last_check) return true;
  return Date.now() - new Date(d.last_check).getTime() > STALE_AFTER_MS;
};

/**
 * Real coordinates only.
 *
 * This used to hash `device_id` into a point inside a fixed geographic box
 * whenever latitude/longitude were absent - `28 + rnd1 * 8`,
 * `-2 + rnd2 * 12` - so a device with no reported location got a marker
 * anyway, deterministic but meaningless. Two devices sitting in the same real
 * place could land hundreds of km apart, because neither point meant
 * anything. A device with no location now has no marker, not an invented one.
 *
 * `_isActive` used to be `index % 3 !== 0` and the "Issues" filter used to be
 * `index % 5 === 0` - both a property of array position, not of the device.
 * There is no "issue" signal returned by the API to replace that with, so the
 * filter is gone rather than given a different fake; `_isActive` is real now,
 * derived from the same staleness rule the device detail page already uses.
 */
type LocatedDevice = Device & { latitude: number; longitude: number };

const hasCoordinates = (d: Device): d is LocatedDevice =>
  typeof d.latitude === "number" && typeof d.longitude === "number";

const mapDevices = computed(() => {
  return items
    .filter(hasCoordinates)
    .map((d) => ({ ...d, _isActive: !isStale(d) }))
    .filter((d) => {
      if (!showControls) return true;
      if (filter.value === "active") return d._isActive;
      if (filter.value === "stale") return !d._isActive;
      return true;
    });
});

/** Devices with no reported location, for the "not shown" count below the map. */
const devicesWithoutLocation = computed(
  () =>
    items.filter((d) => typeof d.latitude !== "number" || typeof d.longitude !== "number").length,
);

watch(
  () => mapDevices.value,
  (devices) => {
    if (devices.length === 1 && !showControls) {
      const d = devices[0];
      if (d && d.latitude && d.longitude) {
        center.value = [d.latitude, d.longitude];
        zoom.value = 14;
      }
    }
  },
  { immediate: true },
);

const getStatusColor = (d: { _isActive?: boolean }) =>
  d._isActive ? "bg-green-500 border-green-600" : "bg-slate-400 border-slate-500";

const formatDate = (dateString?: string) => {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString();
};

const openDeviceDetail = (device: Device) => {
  router.push(`/devices/${device.id}`);
};
</script>

<style>
.leaflet-container {
  font-family: inherit;
  z-index: 0;
}
</style>
