<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useOrganizationStore } from '@/stores/organization.store'
import type { Organization } from '@/types/models'

const props = defineProps<{
  userData: {
    name: string
    email: string
    avatar: string
  }
}>()

const router = useRouter()
const authStore = useAuthStore()
const orgStore = useOrganizationStore()
const { isMobile } = useSidebar()

const { data: organizations } = useOrganizationsQuery()
const activeOrganization = computed(() => orgStore.activeOrganization)

// Auto-select first org if none active
watch(
  organizations,
  (newOrgs) => {
    if (newOrgs && newOrgs.length > 0 && !activeOrganization.value) {
      orgStore.setActiveOrganization(newOrgs[0] as Organization)
    }
  },
  { immediate: true },
)

const selectOrg = (org: Organization) => {
  orgStore.setActiveOrganization(org)
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Avatar class="h-8 w-8 rounded-lg">
              <AvatarImage :src="props.userData.avatar" :alt="props.userData.name" />
              <AvatarFallback class="rounded-lg text-primary-foreground font-bold">
                {{ props.userData.email.charAt(0).toUpperCase() }}
              </AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">{{
                activeOrganization?.name || 'Personal Account'
              }}</span>
              <span class="truncate text-xs text-muted-foreground">Active Workspace</span>
            </div>
            <ILucideChevronsUpDown class="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-[--reka-dropdown-menu-trigger-width] min-w-56 rounded-lg"
          :side="isMobile ? 'bottom' : 'right'"
          align="end"
          :side-offset="4"
        >
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar class="h-8 w-8 rounded-lg">
                <AvatarImage src="/placeholder.png" :alt="props.userData.name" />
                <AvatarFallback class="rounded-lg">
                  {{ props.userData.email.charAt(0).toUpperCase() }}
                </AvatarFallback>
              </Avatar>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-semibold">{{ props.userData.name }}</span>
                <span class="truncate text-xs text-muted-foreground">{{
                  props.userData.email
                }}</span>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuLabel class="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Organizations
          </DropdownMenuLabel>

          <DropdownMenuGroup>
            <DropdownMenuItem
              v-for="org in organizations"
              :key="org.id"
              class="gap-2 px-2 py-1.5 cursor-pointer"
              @click="selectOrg(org)"
            >
              <div
                class="flex size-6 items-center justify-center rounded-sm border bg-background text-xs"
              >
                {{ org.name.charAt(0) }}
              </div>
              <span class="flex-1 truncate">{{ org.name }}</span>
              <ILucideCheck v-if="activeOrganization?.id === org.id" class="size-4" />
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem class="gap-2 px-2 py-1.5 cursor-pointer">
              <ILucidePlus class="size-4" />
              <span>Create organization</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem class="gap-2 px-2 py-1.5 cursor-pointer" @click="handleLogout">
            <ILucideLogOut class="size-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>

<style scoped></style>
