<script setup lang="ts">
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { LocatedDevice } from "../types/devices.types";

const props = defineProps<{ devices: readonly LocatedDevice[] }>();

const host = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let layer: L.LayerGroup | null = null;

function escape(value: string | null | undefined): string {
  return (value ?? "").replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function popup(device: LocatedDevice): string {
  const name = escape(device.device_name || device.model || device.device_id);
  const accuracy = device.location_accuracy_m
    ? `±${Math.round(device.location_accuracy_m)} m`
    : "accuracy unknown";
  return `<strong>${name}</strong><br><code>${escape(device.version_name ?? "builtin")}</code> on ${escape(device.channel_name ?? "no channel")}<br><span>${accuracy}</span>`;
}

function render() {
  if (!map || !layer) return;
  layer.clearLayers();
  const style = getComputedStyle(document.documentElement);
  const color = style.getPropertyValue("--primary").trim() || "#c96442";
  for (const device of props.devices) {
    L.circleMarker([device.latitude, device.longitude], {
      radius: 6,
      weight: 2,
      color,
      fillColor: color,
      fillOpacity: 0.5,
    })
      .bindPopup(popup(device))
      .addTo(layer);
  }
  if (props.devices.length) {
    const bounds = L.latLngBounds(
      props.devices.map((device) => [device.latitude, device.longitude]),
    );
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 12 });
  }
}

onMounted(() => {
  if (!host.value) return;
  map = L.map(host.value, { zoomControl: true, attributionControl: true, preferCanvas: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  map.setView([20, 0], 2);
  layer = L.layerGroup().addTo(map);
  render();
});

watch(() => props.devices, render);

onBeforeUnmount(() => {
  map?.remove();
  map = null;
  layer = null;
});
</script>

<template>
  <div class="overflow-hidden rounded-lg border">
    <div
      ref="host"
      class="h-[calc(100svh-17rem)] min-h-96 w-full"
      role="region"
      aria-label="Devices that reported a location"
    />
  </div>
</template>
