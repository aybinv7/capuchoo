<template>
  <SidebarGroup>
    <SidebarGroupLabel>{{ groupName }}</SidebarGroupLabel>
    <SidebarMenu>
      <Collapsible
        v-for="(item, index) in items"
        :key="item.title"
        as-child
        v-model:open="openStates[index]"
      >
        <SidebarMenuItem>
          <CollapsibleTrigger
            class="cursor-pointer"
            @click.prevent="openStates[index] = !openStates[index]"
            as-child
          >
            <SidebarMenuButton
              @click="goToRoute(item.url)"
              :tooltip="item.title"
              :is-active="isParentActive(item)"
            >
              <component :is="item.icon" />
              <span>{{ item.title }}</span>
              <ChevronRight
                v-if="item.items?.length"
                class="ms-auto transition-transform duration-200"
                :class="{ 'rotate-90': openStates[index], 'rotate-180': direction === 'rtl' }"
                @click.stop="openStates[index] = !openStates[index]"
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>

          <CollapsibleContent v-if="item.items?.length">
            <SidebarMenuSub>
              <SidebarMenuSubItem
                v-for="subItem in item.items"
                :key="subItem.title"
                @click="goToRoute(subItem.url)"
              >
                <SidebarMenuSubButton :is-active="isChildActive(subItem.url)">
                  <span>{{ subItem.title }}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    </SidebarMenu>
  </SidebarGroup>
</template>

<script setup lang="ts">
import type { LucideIcon } from 'lucide-vue-next'
import { ChevronRight } from 'lucide-vue-next'
import { useDirection } from 'reka-ui'
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps<{
  groupName: string
  items: {
    title: string
    url: string
    icon: LucideIcon
    items?: {
      title: string
      url: string
    }[]
  }[]
}>()

const router = useRouter()
const route = useRoute()
const direction = useDirection()
const STORAGE_KEY = 'sidebar-collapsible-states'

const openStates = ref<boolean[]>([])

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      openStates.value = JSON.parse(saved)
      if (openStates.value.length !== props.items.length) {
        openStates.value = initializeStates()
      }
    } catch {
      openStates.value = initializeStates()
    }
  } else {
    openStates.value = initializeStates()
  }
})

const initializeStates = (): boolean[] => {
  return props.items.map((item) => {
    const hasActiveChild = item.items?.some((child) => route.path === child.url)
    return hasActiveChild || false
  })
}

watch(
  openStates,
  (newStates) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newStates))
  },
  { deep: true },
)

watch(
  () => route.path,
  (newPath) => {
    props.items.forEach((item, index) => {
      if (item.items?.some((child) => child.url === newPath)) {
        openStates.value[index] = true
      }
    })
  },
)

const goToRoute = (url: string) => {
  router.push(url)
}

const isParentActive = (item: any): boolean => {
  return route.path === item.url
}

const isChildActive = (url: string): boolean => {
  return route.path === url
}
</script>
