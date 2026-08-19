import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Channel } from '../types/channels.types'

export const useChannelsStore = defineStore('channels', () => {
  // State
  const channels = ref<Channel[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const getAllChannels = computed(() => channels.value)
  const isLoading = computed(() => loading.value)
  const getError = computed(() => error.value)

  // Actions
  const setChannels = (items: Channel[]) => {
    channels.value = items
  }

  const addChannel = (item: Channel) => {
    channels.value.push(item)
  }

  const removeChannel = (id: string) => {
    channels.value = channels.value.filter((item) => item.id !== id)
  }

  const setLoading = (status: boolean) => {
    loading.value = status
  }

  const setError = (message: string | null) => {
    error.value = message
  }

  return {
    channels,
    loading,
    error,
    getAllChannels,
    isLoading,
    getError,
    setChannels,
    addChannel,
    removeChannel,
    setLoading,
    setError,
  }
})
