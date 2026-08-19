<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu v-model:open="isOpen">
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent hover:bg-sidebar-accent group"
          >
            <!-- Active App Icon -->
            <div
              class="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary-foreground/10 border border-sidebar-border text-sidebar-primary-foreground transition-all group-hover:bg-sidebar-primary-foreground/20"
            >
              <img
                v-if="activeApp && activeApp.icon_url"
                :src="activeApp.icon_url"
                class="size-6 object-cover rounded-sm"
              />
              <ILucideAppWindow v-else class="size-5 text-sidebar-primary-background" />
            </div>

            <!-- Header Text -->
            <div class="grid flex-1 text-left text-sm leading-tight ml-1">
              <span class="truncate font-semibold text-sidebar-foreground">
                {{ activeApp?.name || 'Select App' }}
              </span>
              <span class="truncate text-xs text-muted-foreground flex items-center gap-1">
                {{ organizationName }}
                <span v-if="activeApp">• {{ activeApp.platform || 'All Platforms' }}</span>
              </span>
            </div>

            <ILucideChevronsUpDown class="ml-auto size-4 text-muted-foreground/50" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          class="w-[--reka-dropdown-menu-trigger-width] min-w-80 rounded-lg p-0"
          align="start"
          :side="isMobile ? 'bottom' : 'right'"
          :side-offset="4"
        >
          <!-- Context Header -->
          <div class="p-3 bg-muted/30 border-b">
            <div class="flex items-center gap-3 mb-3">
              <div
                class="flex aspect-square size-10 items-center justify-center rounded-lg bg-background border shadow-sm"
              >
                <img
                  v-if="activeApp && activeApp.icon_url"
                  :src="activeApp.icon_url"
                  class="size-7 object-cover rounded-sm"
                />
                <ILucideAppWindow v-else class="size-6 text-foreground" />
              </div>
              <div class="flex-1 overflow-hidden">
                <div class="font-semibold truncate">{{ activeApp?.name || 'No App Selected' }}</div>
                <div class="text-xs text-muted-foreground truncate">
                  {{ organizationName }} • {{ activeApp?.app_id || '...' }}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2" v-if="activeApp">
              <Button
                variant="outline"
                size="sm"
                class="h-7 text-xs flex-1 gap-1.5 font-normal bg-background"
                @click="
                  () => {
                    router.push(`/settings?tab=general`)
                    isOpen = false
                  }
                "
              >
                <ILucideSettings class="size-3.5" />
                Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="h-7 text-xs flex-1 gap-1.5 font-normal bg-background"
                @click="
                  () => {
                    router.push(`/settings?tab=members`)
                    isOpen = false
                  }
                "
              >
                <ILucideUsers class="size-3.5" />
                Members
              </Button>
            </div>
          </div>

          <!-- Apps List -->
          <div class="py-2">
            <div
              class="px-2 pb-1.5 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider pl-3"
            >
              {{ organizationName }}
            </div>
            <div v-if="isLoading" class="p-2 text-xs text-muted-foreground text-center">
              Loading...
            </div>
            <template v-else>
              <DropdownMenuItem
                v-for="app in displayApps"
                :key="app.id"
                class="gap-3 mx-2 px-3 py-2 cursor-pointer focus:bg-accent/50"
                @click="selectApp(app)"
              >
                <div
                  class="flex size-6 items-center justify-center rounded-sm border bg-background"
                >
                  <img
                    v-if="app.icon_url"
                    :src="app.icon_url"
                    class="size-4 shrink-0 object-cover rounded-[2px]"
                  />
                  <ILucideAppWindow v-else class="size-3.5 shrink-0 text-muted-foreground" />
                </div>
                <span class="flex-1 truncate">{{ app.name }}</span>
                <ILucideCheck v-if="activeApp?.id === app.id" class="size-4 text-primary" />
              </DropdownMenuItem>

              <DropdownMenuItem
                v-if="hasMoreApps"
                class="gap-2 mx-2 px-3 py-2 text-muted-foreground cursor-pointer focus:bg-accent/50"
                @click="router.push('/apps')"
              >
                <ILucideMoreHorizontal class="size-4" />
                <span class="text-xs">Show all {{ filteredApps.length }} apps...</span>
              </DropdownMenuItem>
            </template>
          </div>

          <DropdownMenuSeparator />

          <!-- System Actions -->
          <div class="p-2 bg-muted/10">
            <DropdownMenuItem
              class="gap-2 px-3 py-2 cursor-pointer focus:bg-accent/50"
              @click="router.push('/apps/create')"
            >
              <ILucidePlus class="size-4 text-muted-foreground" />
              <div class="font-medium text-muted-foreground">Add new app</div>
            </DropdownMenuItem>
            <DropdownMenuItem
              class="gap-2 px-3 py-2 cursor-pointer focus:bg-accent/50"
              @click="router.push('/apps')"
            >
              <ILucideLayoutGrid class="size-4 text-muted-foreground" />
              <div class="font-medium text-muted-foreground">Manage all apps</div>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>

<script setup lang="ts">
import type { App } from '@/modules/apps/types/apps.types'
import { useOrganizationStore } from '@/stores/organization.store'

const router = useRouter()
const { isMobile } = useSidebar()
const appStore = useAppStore()
const orgStore = useOrganizationStore()
const isOpen = ref(false)

// Queries
const { data: apps, isLoading } = useAppsQuery()

// Computed
const activeApp = computed(() => appStore.activeApp)
const activeOrgId = computed(() => orgStore.activeOrganization?.id)

const organizationName = computed(() => {
  return orgStore.activeOrganization?.name || 'My Organization'
})

const filteredApps = computed(() => {
  if (!apps.value || !activeOrgId.value) return []
  return apps.value.filter((a) => a.organization_id === activeOrgId.value)
})

const displayApps = computed(() => {
  return filteredApps.value.slice(0, 5)
})

const hasMoreApps = computed(() => {
  return filteredApps.value.length > 5
})

// Auto-select first app of org if current app doesn't belong to it
watch(activeOrgId, (newId) => {
  if (newId && activeApp.value && activeApp.value.organization_id !== newId) {
    const firstApp = filteredApps.value[0] || null
    appStore.setActiveApp(firstApp)
  }
})

const selectApp = (app: App) => {
  appStore.setActiveApp(app)
  router.push('/dashboard')
}
</script>
