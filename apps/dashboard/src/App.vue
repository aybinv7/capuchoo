<template>
  <ConfigProvider :locale="language" :dir="langDirection">
    <Sonner rich-colors class="pointer-events-auto" />
    <router-view />
  </ConfigProvider>
</template>
<script setup lang="ts">
import { ConfigProvider } from 'reka-ui'
import 'vue-sonner/style.css'

const authStore = useAuthStore()
const languageStore = useLanguageStore()

const { langDirection, language } = storeToRefs(languageStore)

onMounted(() => {
  authStore.init()
})
</script>
