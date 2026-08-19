<template>
  <div class="relative w-full h-[600px] rounded-lg overflow-hidden border shadow-sm group">
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
              <div>Version: {{ device.current_bundle_id || 'N/A' }}</div>
              <div>Last Seen: {{ formatDate(device.last_check) }}</div>
              <div>State: {{ device.custom_channel || device.channel || 'Standard' }}</div>
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
import 'leaflet/dist/leaflet.css'
import { LMap, LTileLayer, LMarker, LPopup, LIcon } from '@vue-leaflet/vue-leaflet'
import type { Device } from '@/modules/devices/types/devices.types'

const { items, showControls } = defineProps<{
  items: Device[]
  showControls?: boolean
}>()

const router = useRouter()
const zoom = ref(5)
const center = ref<[number, number]>([28.0, 3.0])
const filter = ref<'all' | 'active' | 'issue'>('all')

const mapOptions = {
  minZoom: 5,
  maxZoom: 20,
  maxBounds: [
    [18.0, -7.0],
    [38.0, 10.0],
  ],
  maxBoundsViscosity: 1.0,
  zoomControl: false,
}

const filterOptions = [
  { value: 'all', label: 'All Devices', color: '' },
  { value: 'active', label: 'Active', color: 'bg-green-500' },
  { value: 'issue', label: 'Issues', color: 'bg-amber-500' },
] as const

const algeriaCities = [
  { name: 'Algiers', coords: [36.75, 3.05] },
  { name: 'Oran', coords: [35.69, -0.63] },
  { name: 'Constantine', coords: [36.36, 6.61] },
  { name: 'Ouargla', coords: [31.95, 5.32] },
]

const flyTo = (coords: number[]) => {
  center.value = coords as [number, number]
  zoom.value = 10
}

const getPseudoRandom = (seed: string) => {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  const x = Math.sin(hash) * 10000
  return x - Math.floor(x)
}

const mapDevices = computed(() => {
  return items
    .map((d, index) => {
      const seed = d.device_id || `device-${index}`
      const rnd1 = getPseudoRandom(seed + 'lat')
      const rnd2 = getPseudoRandom(seed + 'lng')

      const active = index % 3 !== 0

      const baseLat = 28 + rnd1 * 8
      const baseLng = -2 + rnd2 * 12

      const lat = d.latitude ?? baseLat
      const lng = d.longitude ?? baseLng

      const hasIssue = index % 5 === 0

      return {
        ...d,
        latitude: lat,
        longitude: lng,
        _hasIssue: hasIssue,
        _isActive: active,
      }
    })
    .filter((d) => {
      if (!showControls) return true
      if (filter.value === 'issue') return d._hasIssue
      return true
    })
})

watch(
  () => mapDevices.value,
  (devices) => {
    if (devices.length === 1 && !showControls) {
      const d = devices[0]
      if (d && d.latitude && d.longitude) {
        center.value = [d.latitude, d.longitude]
        zoom.value = 14
      }
    }
  },
  { immediate: true },
)

const getStatusColor = (d: any) => {
  if (d._hasIssue) return 'bg-amber-500 border-amber-600'
  if (d._isActive) return 'bg-green-500 border-green-600'
  return 'bg-slate-400 border-slate-500'
}

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString()
}

const openDeviceDetail = (device: Device) => {
  router.push(`/devices/${device.id}`)
}

onMounted(() => {
  console.log(items)
})
</script>

<style>
.leaflet-container {
  font-family: inherit;
  z-index: 0;
}
</style>
