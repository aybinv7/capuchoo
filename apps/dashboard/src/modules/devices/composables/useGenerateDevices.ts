import { faker } from '@faker-js/faker'
import type { Device } from '@/modules/devices/types/devices.types'

/**
 * 20 Algerian cluster centers (cities)
 */
const CLUSTER_CENTERS = [
  { name: 'Algiers', lat: 36.7538, lng: 3.0588 },
  { name: 'Oran', lat: 35.6971, lng: -0.6308 },
  { name: 'Constantine', lat: 36.365, lng: 6.6147 },
  { name: 'Annaba', lat: 36.9062, lng: 7.7558 },
  { name: 'Tlemcen', lat: 34.8783, lng: -1.315 },
  { name: 'Bejaia', lat: 36.7509, lng: 5.0567 },
  { name: 'Setif', lat: 36.1911, lng: 5.4137 },
  { name: 'Ghardaia', lat: 32.49, lng: 3.6737 },
  { name: 'Tizi-Ouzou', lat: 36.7169, lng: 4.0497 },
  { name: 'Blida', lat: 36.4745, lng: 2.8289 },
  { name: 'Batna', lat: 35.555, lng: 6.1746 },
  { name: 'Biskra', lat: 34.8504, lng: 5.728 },
  { name: 'Laghouat', lat: 33.8006, lng: 2.8651 },
  { name: 'El Oued', lat: 33.3683, lng: 6.8674 },
  { name: 'Boumerdes', lat: 36.7544, lng: 3.473 },
  { name: 'Skikda', lat: 36.8799, lng: 6.9064 },
  { name: 'Jijel', lat: 36.8205, lng: 5.7663 },
  { name: 'Mascara', lat: 35.396, lng: 0.1403 },
  { name: 'Saida', lat: 34.8303, lng: 0.1453 },
  { name: 'Tiaret', lat: 35.371, lng: 1.321 },
]

/**
 * Convert km offsets to lat/lng degrees
 * 1 deg lat ≈ 111 km
 * 1 deg lng depends on latitude => cos(lat) * 111 km
 */
function kmToDegrees(centerLat: number, kmLat: number, kmLng: number) {
  const lat = kmLat / 111
  const lng = kmLng / (111 * Math.cos((centerLat * Math.PI) / 180))
  return { lat, lng }
}

/**
 * Generates realistic spatial clusters:
 * Points spread out in a natural circular radius (1–5 km)
 */
export function useGenerateClusteredDevices(
  clusters: number = 20,
  pointsPerCluster: number = 100,
  clusterRadiusKm: number = 3, // recommended 2 to 5 km
): Device[] {
  const devices: Device[] = []
  const now = new Date().toISOString()

  for (let c = 0; c < clusters; c++) {
    const center = CLUSTER_CENTERS[c % CLUSTER_CENTERS.length] as {
      name: string
      lat: number
      lng: number
    }

    for (let i = 0; i < pointsPerCluster; i++) {
      const id = faker.string.uuid()

      // Generate natural "cloud" dispersion using radial randomness
      const angle = faker.number.float({ min: 0, max: Math.PI * 2 }) // random 360°
      const distance = faker.number.float({
        min: 0.2, // min 200 meters from center
        max: clusterRadiusKm, // max radius cluster size
      })

      const kmLat = Math.cos(angle) * distance
      const kmLng = Math.sin(angle) * distance
      const offset = kmToDegrees(center.lat, kmLat, kmLng)

      devices.push({
        id,
        device_id: faker.helpers.arrayElement([
          'iphone-13-pro-max',
          'pixel-6-pro',
          'samsung-s21',
          'ipad-air-4',
          'oneplus-9',
          'mi-11',
          'huawei-p40',
          'oppo-find-x5',
        ]),
        platform: faker.helpers.arrayElement(['ios', 'android']),
        channel: faker.helpers.arrayElement(['prod', 'staging', 'dev']),
        current_bundle_id: faker.system.semver(),
        last_check: faker.date.recent().toISOString(),
        latitude: center.lat + offset.lat,
        longitude: center.lng + offset.lng,
        created_at: now,
      })
    }
  }

  return devices
}
