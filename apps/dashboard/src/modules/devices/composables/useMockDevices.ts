import type { Device } from '../types/devices.types'

export function useMockDevices(count: number = 100): Device[] {
  const mockDevices: Device[] = []

  const platforms = ['ios', 'android']
  const channels = ['prod', 'staging', 'dev']
  const bundleIds = [
    'com.example.app.v1.0.0',
    'com.example.app.v1.1.0',
    'com.example.app.v1.2.0',
    'com.example.app.v2.0.0',
    'com.example.app.v2.1.0',
    'com.example.app.v3.0.0',
  ]

  // Algeria coordinates: latitude between 18 and 38, longitude between -9 and 12
  const minLat = 18.0
  const maxLat = 38.0
  const minLng = -9.0
  const maxLng = 12.0

  for (let i = 0; i < count; i++) {
    const platform = platforms[Math.floor(Math.random() * platforms.length)] as 'android' | 'ios'
    const channel = channels[Math.floor(Math.random() * channels.length)]
    const bundleId = bundleIds[Math.floor(Math.random() * bundleIds.length)]

    // Generate random coordinates within Algeria
    const latitude = minLat + Math.random() * (maxLat - minLat)
    const longitude = minLng + Math.random() * (maxLng - minLng)

    // Generate random dates within the last year
    const randomDate = new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000))

    mockDevices.push({
      id: `mock-device-${i}`,
      device_id: `device-${i.toString().padStart(4, '0')}`,
      app_id: 'com.example.app',
      platform,
      current_bundle_id: Math.random() > 0.3 ? bundleId : '', // Sometimes no bundle
      created_at: randomDate.toISOString(),
      updated_at: randomDate.toISOString(),
      last_check: randomDate.toISOString(),
      channel: channel === 'production' ? undefined : channel,
      custom_channel: channel === 'production' ? channel : undefined,
      latitude,
      longitude,
    })
  }

  return mockDevices
}
