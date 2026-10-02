<script setup lang="ts">
import L from "leaflet";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { createBaseMap, markerColor } from "../lib/leaflet-map";

const props = defineProps<{ latitude: number; longitude: number; accuracy: number | null }>();

const host = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let layer: L.LayerGroup | null = null;

function render() {
  if (!map || !layer) return;
  layer.clearLayers();
  const color = markerColor();
  const center = L.latLng(props.latitude, props.longitude);
  if (props.accuracy && props.accuracy > 0) {
    const circle = L.circle(center, {
      radius: props.accuracy,
      weight: 1,
      color,
      fillColor: color,
      fillOpacity: 0.12,
    }).addTo(layer);
    map.fitBounds(circle.getBounds(), { padding: [24, 24], maxZoom: 16 });
  } else {
    map.setView(center, 15);
  }
  L.circleMarker(center, { radius: 5, weight: 2, color, fillColor: color, fillOpacity: 0.9 }).addTo(
    layer,
  );
}

onMounted(() => {
  if (!host.value) return;
  map = createBaseMap(host.value, { scrollWheelZoom: false });
  layer = L.layerGroup().addTo(map);
  render();
});

watch(() => [props.latitude, props.longitude, props.accuracy], render);

onBeforeUnmount(() => {
  map?.remove();
  map = null;
  layer = null;
});
</script>

<template>
  <div ref="host" class="isolate h-52 w-full" role="region" aria-label="Last reported location" />
</template>
