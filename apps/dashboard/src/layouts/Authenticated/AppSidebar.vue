<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <AppSwitcher />
    </SidebarHeader>
    <SidebarContent class="flex flex-col justify-between items-start h-full">
      <div class="w-full">
        <NavMain :items="appDashboard" group-name="Dashboard" />
        <NavMain :items="appEssentials" group-name="Modules" />
      </div>
      <NavMain :items="appSettings" group-name="Settings" />
    </SidebarContent>
    <SidebarFooter>
      <NavUser :user-data="navUser" />
    </SidebarFooter>
  </Sidebar>
</template>
<script setup lang="ts">
import SidebarHeader from '@/components/ui/sidebar/SidebarHeader.vue'
import NavMain from './NavMain.vue'
import AppSwitcher from './AppSwitcher.vue'

import type { SidebarProps } from '@/components/ui/sidebar'
import {
  Home,
  BarChart3,
  GitBranch,
  Radio,
  Smartphone,
  ScrollText,
  Settings2,
  Workflow,
} from 'lucide-vue-next'
import NavUser from './NavUser.vue'

const props = withDefaults(defineProps<SidebarProps>(), {
  variant: 'inset',
})

const authStore = useAuthStore()
const { user } = storeToRefs(authStore)

const navUser = computed(() => ({
  name: user.value?.email?.split('@')[0] ?? '',
  email: user.value?.email ?? '',
  avatar: user.value?.user_metadata?.avatar_url ?? '/palceholder.png',
}))

const appDashboard = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: Home,
  },
  {
    title: 'Statistics',
    url: '/statistics',
    icon: BarChart3,
  },
  {
    title: 'Canvas',
    url: '/canvas',
    icon: Workflow,
  },
]

const appEssentials = [
  {
    title: 'Updates & Bundles',
    url: '/updates-bundles',
    icon: GitBranch,
    items: [
      { title: 'All Updates', url: '/updates-bundles' },
      { title: 'Upload Bundle', url: '/updates-bundles/upload' },
    ],
  },
  {
    title: 'Channels',
    url: '/channels',
    icon: Radio,
    items: [
      { title: 'All Channels', url: '/channels' },
      { title: 'Create Channel', url: '/channels/create' },
    ],
  },
  {
    title: 'Devices',
    url: '/devices',
    icon: Smartphone,
    items: [
      { title: 'All Devices', url: '/devices' },
      { title: 'Device Map', url: '/devices/map' },
    ],
  },
  {
    title: 'Update Logs',
    url: '/update-logs',
    icon: ScrollText,
    items: [{ title: 'Activity Feed', url: '/update-logs' }],
  },
]

const appSettings = [
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings2,
  },
]
</script>
