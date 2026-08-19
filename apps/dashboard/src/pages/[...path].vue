<template>
  <Empty>
    <EmptyHeader>
      <EmptyTitle>{{ t('404.title', '404 - Page Not Found') }}</EmptyTitle>
      <EmptyDescription>
        {{
          t(
            '404.description',
            "The page you're looking for doesn't exist. Try searching for what you need below.",
          )
        }}
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <div class="w-full max-w-md mx-auto">
        <Button @click="openCommandPalette" variant="outline" class="w-full justify-start">
          <span class="mr-2 text-muted-foreground">
            <Search class="size-4" />
          </span>
          {{ t('404.search_placeholder', 'Search pages, features, and actions...') }}
          <span class="ml-auto text-xs text-muted-foreground">
            {{ t('404.press_slash', 'Press /') }}
          </span>
        </Button>
        <EmptyDescription class="mt-4">
          {{ t('404.need_help', 'Need help?') }}
          <a href="#" @click.prevent="contactSupport">{{
            t('404.contact_support', 'Contact support')
          }}</a>
        </EmptyDescription>
      </div>
    </EmptyContent>
  </Empty>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { useToast } from '@/composables/useToast'
import type SearchCommand from '@/layouts/Authenticated/SearchCommand.vue'
import { Search } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { showToast } = useToast()

const searchCommandRef = ref<InstanceType<typeof SearchCommand> | null>(null)

const openCommandPalette = () => {
  if (searchCommandRef.value?.openCommandPalette) {
    searchCommandRef.value.openCommandPalette()
  }
}

const contactSupport = () => {
  showToast(t('404.support_contacted', 'Support contacted'), 'success')
  console.log('Contact support action triggered')
}

definePage({
  meta: {
    title: 'Page Not Found',
    description: 'The page you are looking for does not exist',
    category: 'error',
    hideFromSearch: true,
  },
})
</script>
