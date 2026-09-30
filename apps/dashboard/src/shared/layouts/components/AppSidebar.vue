<script setup lang="ts">
import { computed } from "vue";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useCurrentApp } from "../../composables/useCurrentApp";
import { APP_NAVIGATION, WORKSPACE_NAVIGATION } from "../navigation";
import NavMain from "./NavMain.vue";
import NavSecondary from "./NavSecondary.vue";
import UserMenu from "./UserMenu.vue";
import WorkspaceSwitcher from "./WorkspaceSwitcher.vue";

const { app, role } = useCurrentApp();
const params = computed(() => (app.value ? { appId: app.value.id } : undefined));
</script>

<template>
  <Sidebar variant="inset" collapsible="icon">
    <SidebarHeader>
      <WorkspaceSwitcher />
    </SidebarHeader>
    <SidebarContent>
      <NavMain v-if="app" :groups="APP_NAVIGATION" :role="role" :params="params" />
      <NavMain v-else :groups="WORKSPACE_NAVIGATION" />
      <NavSecondary :in-app="Boolean(app)" class="mt-auto" />
    </SidebarContent>
    <SidebarFooter>
      <UserMenu />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
