import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { App } from '@/modules/apps/types/apps.types'

export const useAppStore = defineStore('app', () => {
  const activeApp = ref<App | null>(null)

  // Initialize from localStorage
  const init = () => {
    const stored = localStorage.getItem('active_app')
    if (stored) {
      try {
        activeApp.value = JSON.parse(stored)
      } catch {
        localStorage.removeItem('active_app')
      }
    }
  }

  // Persist to localStorage
  watch(activeApp, (newVal) => {
    if (newVal) {
      localStorage.setItem('active_app', JSON.stringify(newVal))
    } else {
      localStorage.removeItem('active_app')
    }
  })

  // Set active app
  const setActiveApp = (app: App | null) => {
    activeApp.value = app
  }

  // Initialize on store creation
  init()

  return {
    activeApp,
    setActiveApp,
  }
})
