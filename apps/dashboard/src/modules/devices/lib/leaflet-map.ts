import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** An OpenStreetMap-backed map on `host`, drawn on canvas. Only the lazy map components import this. */
export function createBaseMap(host: HTMLElement, options: L.MapOptions = {}): L.Map {
  const map = L.map(host, {
    zoomControl: true,
    attributionControl: true,
    preferCanvas: true,
    ...options,
  });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  return map;
}

/** The theme's primary colour, which markers use so the map matches the rest of the page. */
export function markerColor(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#c96442"
  );
}
