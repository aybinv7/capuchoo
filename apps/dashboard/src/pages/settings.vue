<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200"
  >
    <!-- Click outside to close -->
    <div class="absolute inset-0" @click="closeSettings"></div>

    <!-- Modal Container -->
    <div
      class="relative w-full max-w-5xl h-[85vh] bg-background rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-border animate-in zoom-in-95 duration-200"
      role="dialog"
      aria-modal="true"
    >
      <!-- Sidebar -->
      <div class="w-full md:w-64 bg-muted/30 border-r flex flex-col h-full">
        <!-- Sidebar Header -->
        <div class="p-4 flex items-center gap-3 border-b border-border/40">
          <Avatar class="h-8 w-8 rounded-sm">
            <AvatarImage :src="user?.user_metadata?.avatar_url || ''" />
            <AvatarFallback class="rounded-sm">{{ initials }}</AvatarFallback>
          </Avatar>
          <div class="flex flex-col overflow-hidden">
            <span class="text-sm font-medium truncate">{{
              user?.user_metadata?.full_name || user?.email
            }}</span>
            <span class="text-xs text-muted-foreground truncate">{{
              activeApp?.name || 'No App'
            }}</span>
          </div>
        </div>

        <!-- Sidebar Navigation -->
        <div class="flex-1 overflow-y-auto py-4 px-2 space-y-6">
          <!-- Account Section -->
          <div class="space-y-1">
            <h4
              class="px-2 text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider"
            >
              Account
            </h4>
            <button
              v-for="tab in accountTabs"
              :key="tab.id"
              @click="currentTab = tab.id"
              class="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors text-left"
              :class="[
                currentTab === tab.id
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              ]"
            >
              <component :is="tab.icon" class="size-4" />
              {{ tab.label }}
            </button>
          </div>

          <!-- App Section -->
          <div v-if="activeApp" class="space-y-1">
            <h4
              class="px-2 text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider"
            >
              App Settings
            </h4>
            <button
              v-for="tab in appTabs"
              :key="tab.id"
              @click="currentTab = tab.id"
              class="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors text-left"
              :class="[
                currentTab === tab.id
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              ]"
            >
              <component :is="tab.icon" class="size-4" />
              {{ tab.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col h-full bg-background relative">
        <!-- Close Button -->
        <button
          @click="closeSettings"
          class="absolute top-4 right-4 p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors z-10"
          title="Close Settings"
        >
          <ILucideX class="size-5" />
        </button>

        <!-- Content Scroll Area -->
        <div class="flex-1 overflow-y-auto px-8 py-10 md:px-12 md:py-12 w-full max-w-3xl mx-auto">
          <transition name="fade" mode="out-in">
            <component :is="activeComponent" :key="currentTab" />
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store'
import { useAppStore } from '@/stores/app.store'
import { storeToRefs } from 'pinia'
import { User, Settings2, Users, KeyRound, Database } from 'lucide-vue-next'

// Import Components
import SettingsAccount from '@/components/settings/SettingsAccount.vue'
import SettingsApp from '@/components/settings/SettingsApp.vue'
import SettingsMembers from '@/components/settings/SettingsMembers.vue'
import SettingsApiKeys from '@/components/settings/SettingsApiKeys.vue'
import SettingsConfig from '@/components/settings/SettingsConfig.vue'

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

const { user } = storeToRefs(authStore)
const { activeApp } = storeToRefs(appStore)

const initials = computed(() => {
  const metadata = user.value?.user_metadata
  const name = metadata?.full_name || user.value?.email || '?'
  return name.substring(0, 2).toUpperCase()
})

const closeSettings = () => {
  router.push('/dashboard')
}

const route = useRoute()

// Tab Configuration
const accountTabs = [
  { id: 'account', label: 'My Account', icon: User, component: SettingsAccount },
  { id: 'api-keys', label: 'API Keys', icon: KeyRound, component: SettingsApiKeys },
]

const appTabs = [
  { id: 'general', label: 'General', icon: Settings2, component: SettingsApp },
  { id: 'config', label: 'Configuration', icon: Database, component: SettingsConfig },
  { id: 'members', label: 'Members', icon: Users, component: SettingsMembers },
]

const currentTab = computed({
  get: () => (route.query.tab as string) || 'account',
  set: (val) => router.replace({ query: { ...route.query, tab: val } }),
})

const activeComponent = computed(() => {
  const allTabs = [...accountTabs, ...appTabs]
  return allTabs.find((t) => t.id === currentTab.value)?.component || SettingsAccount
})

// Handle Esc key
onMounted(() => {
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeSettings()
  }
  window.addEventListener('keydown', handleEsc)
  onUnmounted(() => window.removeEventListener('keydown', handleEsc))
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
