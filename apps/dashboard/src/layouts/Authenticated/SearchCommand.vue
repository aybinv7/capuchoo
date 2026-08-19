<template>
  <CommandDialog v-model:open="isOpen" @update:open="handleOpenChange">
    <CommandInput
      :placeholder="placeholder || t('404.search_placeholder')"
      @keypress.enter="handleSearchSubmit"
      @keydown.escape="handleEscape"
      ref="searchInputRef"
    />
    <CommandList :class="props.maxHeightClass">
      <CommandEmpty>
        {{ t('404.no_results', 'No results found. Try a different search term.') }}
      </CommandEmpty>
      <CommandGroup :heading="t('404.main_sections', 'Main Sections')">
        <CommandItem
          v-for="item in filteredItems"
          :key="item.url"
          :value="item.title + ' ' + item.description"
          @select="() => handleItemSelect(item)"
        >
          <div class="flex flex-col items-start">
            <span class="font-medium">{{ item.title }}</span>
            <span class="text-xs text-muted-foreground">{{ item.description }}</span>
          </div>
          <CommandShortcut v-if="item.shortcut">
            {{ item.shortcut }}
          </CommandShortcut>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>

<script setup lang="ts">
import CommandDialog from '@/components/ui/command/CommandDialog.vue'
import CommandEmpty from '@/components/ui/command/CommandEmpty.vue'
import CommandGroup from '@/components/ui/command/CommandGroup.vue'
import CommandInput from '@/components/ui/command/CommandInput.vue'
import CommandItem from '@/components/ui/command/CommandItem.vue'
import CommandList from '@/components/ui/command/CommandList.vue'
import CommandShortcut from '@/components/ui/command/CommandShortcut.vue'
import { useToast } from '@/composables/useToast'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

interface Props {
  placeholder?: string
  maxHeightClass?: string
}

const router = useRouter()
const { t } = useI18n()
const { showToast } = useToast()

const props = withDefaults(defineProps<Props>(), {
  placeholder: undefined,
  maxHeightClass: 'max-h-64',
})

const isOpen = ref(false)

const searchInputRef = ref()

const extractSearchableItems = () => {
  const routes = router.getRoutes()
  const searchableItems = []
  const uniqueItemsMap = new Map()

  const excludedRoutes = ['Path', 'index', 'auth', 'auth.login', 'auth.register'] // 404 page and auth pages

  for (const route of routes) {
    if (excludedRoutes.some((excluded) => route.name?.toString().includes(excluded))) {
      continue
    }

    if (route.meta?.noSearch || route.meta?.hideFromSearch) {
      continue
    }

    if (route.path.includes(':') || (route.path.includes('[') && route.path.includes(']'))) {
      continue
    }

    if (route.path.startsWith('/auth') || route.path === '/') {
      continue
    }

    let title = route.meta?.title || (route.name ? String(route.name) : route.path)
    let description =
      route.meta?.description ||
      route.meta?.subtitle ||
      t(`routes.${route.name ? String(route.name) : ''}.description`, '')

    if (!title || title === route.path) {
      title = route.path
        .replace(/^\//, '')
        .replace(/-/g, ' ')
        .replace(/\//g, ' > ')
        .split(' > ')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' > ')

      if (!route.meta?.title) {
        const i18nTitle = t(`routes.${route.name ? String(route.name) : ''}`, '')
        if (i18nTitle && !i18nTitle.includes('routes.')) {
          title = i18nTitle
        } else {
          const commonTitle = t(`${route.path.replace(/^\//, '').replace(/\//g, '.')}.title`, '')
          if (commonTitle && !commonTitle.includes('.')) {
            title = commonTitle
          }
        }
      }
    }

    if (!description || typeof description !== 'string') {
      description = t(`routes.${route.name ? String(route.name) : ''}.description`, '')
      if (typeof description === 'string' && description.includes('routes.')) {
        description = t(`${route.path.replace(/^\//, '').replace(/\//g, '.')}.description`, '')
        if (typeof description === 'string' && description.includes('routes.')) {
          description = t(`${route.path.replace(/^\//, '').replace(/\//g, '.')}s.description`, '') // for plural forms
          if (typeof description === 'string' && description.includes('routes.')) {
            description = t('routes.default_description', 'Navigate to this page')
          }
        }
      }
    }

    if (typeof description !== 'string') {
      description = t('routes.default_description', 'Navigate to this page')
    }

    const uniqueId = route.path
    if (uniqueItemsMap.has(uniqueId)) {
      continue
    }

    const shortcut = typeof title === 'string' ? title.charAt(0).toUpperCase() : ''

    const item = {
      title,
      description,
      url: route.path,
      shortcut,
      category: route.meta?.category || route.path.split('/')[1] || 'general',
      routeName: route.name?.toString(),
    }

    uniqueItemsMap.set(uniqueId, item)
    searchableItems.push(item)
  }

  return searchableItems
}

const allSearchableItems = computed(() => {
  return extractSearchableItems()
})

const searchQuery = ref('')

const filteredItems = computed(() => {
  if (!searchQuery.value || !searchQuery.value.trim()) {
    return allSearchableItems.value
  }

  const query = typeof searchQuery.value === 'string' ? searchQuery.value.toLowerCase() : ''
  return allSearchableItems.value.filter((item) => {
    const itemTitle = typeof item.title === 'string' ? item.title.toLowerCase() : ''
    const itemDescription =
      typeof item.description === 'string' ? item.description.toLowerCase() : ''
    const itemUrl = item.url && typeof item.url === 'string' ? item.url.toLowerCase() : ''

    return (
      itemTitle.includes(query) ||
      itemDescription.includes(query) ||
      (itemUrl && itemUrl.includes(query))
    )
  })
})

watch(searchQuery, async () => {
  await nextTick()
  if (isOpen.value && searchInputRef.value?.$el) {
    searchInputRef.value.$el.focus()
  }
})

const openCommandPalette = () => {
  isOpen.value = true
  nextTick(() => {
    if (searchInputRef.value?.$el) {
      searchInputRef.value.$el.focus()
    }
  })
}

const closeCommandPalette = () => {
  isOpen.value = false
  searchQuery.value = ''
}

const handleOpenChange = (open: boolean) => {
  isOpen.value = open
  if (!open) {
    searchQuery.value = ''
  }
}

const handleEscape = () => {
  closeCommandPalette()
}

onMounted(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
      e.preventDefault()
      openCommandPalette()
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      openCommandPalette()
    }
  }

  window.addEventListener('keydown', handleKeyPress)

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyPress)
  })
})

const handleItemSelect = (item: any) => {
  try {
    if (item.action === 'add' && item.url) {
      router.push(item.url)
    } else if (item.url) {
      router.push(item.url)
    }
  } catch (error) {
    showToast(t('404.navigation_error', 'Error navigating to page'), 'error')
    console.error('Navigation error:', error)
  } finally {
    closeCommandPalette()
  }
}

const handleSearchSubmit = () => {
  if (filteredItems.value.length > 0) {
    handleItemSelect(filteredItems.value[0])
  }
}

defineExpose({
  openCommandPalette,
  closeCommandPalette,
  isOpen,
  searchInputRef,
  searchQuery,
  filteredItems,
  allSearchableItems,
})
</script>
