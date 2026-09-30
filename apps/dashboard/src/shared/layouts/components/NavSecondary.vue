<script setup lang="ts">
import { KeyRound, LayoutGrid, Search, Users } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { Kbd } from "@/components/ui/kbd";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { RouteName } from "../../router/route-names";
import { useCommandStore } from "../../stores/command.store";

const props = defineProps<{ inApp: boolean }>();

const route = useRoute();
const store = useCommandStore();

const links = computed(() =>
  props.inApp
    ? [
        { name: RouteName.apps, label: "All apps", icon: LayoutGrid },
        { name: RouteName.organization, label: "Organization", icon: Users },
        { name: RouteName.apiKeys, label: "API keys", icon: KeyRound },
      ]
    : [],
);
</script>

<template>
  <SidebarGroup>
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="sm" tooltip="Search" @click="store.show()">
            <Search />
            <span>Search</span>
          </SidebarMenuButton>
          <SidebarMenuBadge><Kbd class="bg-transparent">/</Kbd></SidebarMenuBadge>
        </SidebarMenuItem>
        <SidebarMenuItem v-for="link in links" :key="link.name">
          <SidebarMenuButton
            as-child
            size="sm"
            :tooltip="link.label"
            :is-active="route.name === link.name"
          >
            <RouterLink :to="{ name: link.name }">
              <component :is="link.icon" />
              <span>{{ link.label }}</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
