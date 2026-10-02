<script setup lang="ts">
import L from "leaflet";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { RouteName } from "@/shared/router/route-names";
import { createBaseMap, markerColor } from "../lib/leaflet-map";
import type { LocatedDevice } from "../types/devices.types";

const props = defineProps<{ devices: readonly LocatedDevice[] }>();
const emit = defineEmits<{ open: [device: LocatedDevice] }>();

const router = useRouter();
const host = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let layer: L.LayerGroup | null = null;

function line(tag: string, content: string, className?: string): HTMLElement {
  const element = document.createElement(tag);
  element.textContent = content;
  if (className) element.className = className;
  return element;
}

function popup(device: LocatedDevice): HTMLElement {
  const root = document.createElement("div");
  root.append(
    line("strong", device.device_name || device.model || device.device_id),
    document.createElement("br"),
    line("code", device.version_name ?? "builtin"),
    document.createTextNode(` on ${device.channel_name ?? "no channel"}`),
    document.createElement("br"),
    line(
      "span",
      device.location_accuracy_m
        ? `±${Math.round(device.location_accuracy_m)} m`
        : "accuracy unknown",
    ),
    document.createElement("br"),
  );
  const link = line("a", "Open device");
  link.setAttribute(
    "href",
    router.resolve({
      name: RouteName.device,
      params: { appId: device.app_id, deviceId: device.id },
    }).href,
  );
  link.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    emit("open", device);
  });
  root.append(link);
  return root;
}

function render() {
  if (!map || !layer) return;
  layer.clearLayers();
  const color = markerColor();
  for (const device of props.devices) {
    L.circleMarker([device.latitude, device.longitude], {
      radius: 6,
      weight: 2,
      color,
      fillColor: color,
      fillOpacity: 0.5,
    })
      .bindPopup(() => popup(device))
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
  map = createBaseMap(host.value);
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
