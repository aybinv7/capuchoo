<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { AppRole } from "@capuchoo/core";
import { hasAppRole } from "../../lib/roles";
import type { NavGroup, NavItem } from "../navigation";

const props = defineProps<{
  groups: NavGroup[];
  role?: AppRole | null;
  params?: Record<string, string>;
}>();

const route = useRoute();

const visible = computed(() =>
  props.groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.minRole || hasAppRole(props.role, item.minRole)),
    }))
    .filter((group) => group.items.length > 0),
);

const isActive = (item: NavItem) =>
  route.name === item.name || (item.also ?? []).some((name) => route.name === name);
</script>

<template>
  <SidebarGroup v-for="group in visible" :key="group.label">
    <SidebarGroupLabel>{{ group.label }}</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem v-for="item in group.items" :key="item.name">
          <SidebarMenuButton as-child :is-active="isActive(item)" :tooltip="item.label">
            <RouterLink :to="{ name: item.name, params: props.params }">
              <component :is="item.icon" />
              <span>{{ item.label }}</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
