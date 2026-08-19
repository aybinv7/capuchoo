import { defineStore } from 'pinia'
import { useDirection, useLocale } from 'reka-ui'

import { computed, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import CircleFlagsDz from '~icons/circle-flags/dz'
import CircleFlagsFr from '~icons/circle-flags/fr'
import CircleFlagsUs from '~icons/circle-flags/us'

export interface LanguageItem {
  name: 'Arabic' | 'French' | 'English'
  icon: Component
}

export type AvailableLang = 'ar' | 'fr' | 'en'

export type Languages = Record<AvailableLang, LanguageItem>

export const useLanguageStore = defineStore('language', () => {
  const { locale } = useI18n()

  const languages: Languages = {
    ar: {
      name: 'Arabic',
      icon: CircleFlagsDz,
    },
    fr: {
      name: 'French',
      icon: CircleFlagsFr,
    },
    en: {
      name: 'English',
      icon: CircleFlagsUs,
    },
  }

  const language = ref<AvailableLang>(
    (localStorage.getItem('user-lang') as AvailableLang) ||
      navigator.languages[0]?.split('-')[0] ||
      'en',
  )

  const applyHtmlAttributes = (lang: AvailableLang) => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }

  applyHtmlAttributes(language.value)

  const setLanguage = (lang: AvailableLang) => {
    language.value = lang
    locale.value = lang
    localStorage.setItem('user-lang', lang)
    applyHtmlAttributes(lang)
  }

  const langDirection = computed(() => {
    return language.value === 'ar' ? 'rtl' : 'ltr'
  })

  return {
    language,
    languages,
    langDirection,
    setLanguage,
  }
})
