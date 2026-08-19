<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon">
        <component :is="languageStore.languages[language].icon" />
        <span class="sr-only">Toggle language</span>
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end">
      <DropdownMenuItem
        v-for="[key, lang] in Object.entries(languageStore.languages)"
        :key="key"
        @click="languageStore.setLanguage(key as AvailableLang)"
      >
        <component :is="lang.icon" />
        {{ lang.name }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
const languageStore = useLanguageStore()
const { language } = storeToRefs(languageStore)
</script>
