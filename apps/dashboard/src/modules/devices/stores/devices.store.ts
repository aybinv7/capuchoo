import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Device } from '../types/devices.types'

export const useDevicesStore = defineStore('devices', () => {
  // State
  const devices = ref<Device[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const getAllDevices = computed(() => devices.value)
  const isLoading = computed(() => loading.value)
  const getError = computed(() => error.value)

  // Actions
  const setDevices = (items: Device[]) => {
    devices.value = items
  }

  const removeDevice = (id: string) => {
    devices.value = devices.value.filter((item) => item.id !== id)
  }

  return {
    devices,
    loading,
    error,
    getAllDevices,
    isLoading,
    getError,
    setDevices,
    removeDevice,
  }
})
