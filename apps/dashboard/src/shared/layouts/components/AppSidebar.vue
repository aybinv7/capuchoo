<script setup lang="ts">
import { computed } from "vue";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useCurrentApp } from "../../composables/useCurrentApp";
import { APP_NAVIGATION, WORKSPACE_NAVIGATION } from "../navigation";
import AppSwitcher from "./AppSwitcher.vue";
import NavGroups from "./NavGroups.vue";
import OrganizationSwitcher from "./OrganizationSwitcher.vue";
import UserMenu from "./UserMenu.vue";

const { app, role } = useCurrentApp();
const params = computed(() => (app.value ? { appId: app.value.id } : undefined));
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader>
      <OrganizationSwitcher />
    </SidebarHeader>
    <SidebarContent>
      <template v-if="app">
        <SidebarGroup class="py-0">
          <AppSwitcher />
        </SidebarGroup>
        <NavGroups :groups="APP_NAVIGATION" :role="role" :params="params" />
        <SidebarSeparator />
      </template>
      <NavGroups :groups="WORKSPACE_NAVIGATION" />
    </SidebarContent>
    <SidebarFooter>
      <UserMenu />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
