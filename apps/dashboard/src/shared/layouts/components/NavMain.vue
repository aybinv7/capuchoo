<script setup lang="ts">
import type { AppRole } from "@capuchoo/core";
import { ChevronRight } from "@lucide/vue";
import { computed } from "vue";
import { cn } from "@/lib/utils";
import { RouterLink, useRoute } from "vue-router";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { navItemVisible, type NavBadge, type NavGroup, type NavItem } from "../navigation";

const props = defineProps<{
  groups: NavGroup[];
  role?: AppRole | null;
  params?: Record<string, string>;
  instanceAdmin?: boolean;
  badges?: Partial<Record<string, NavBadge>>;
}>();

const route = useRoute();

const visible = computed(() =>
  props.groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => navItemVisible(item, props.role, props.instanceAdmin)),
    }))
    .filter((group) => group.items.length > 0),
);

const isChildActive = (item: NavItem) =>
  (item.children ?? []).some((child) => route.name === child.name);

const isActive = (item: NavItem) =>
  route.name === item.name ||
  (item.also ?? []).some((name) => route.name === name) ||
  isChildActive(item);
</script>

<template>
  <SidebarGroup v-for="group in visible" :key="group.label">
    <SidebarGroupLabel>{{ group.label }}</SidebarGroupLabel>
    <SidebarMenu>
      <Collapsible
        v-for="item in group.items"
        :key="item.name"
        as-child
        :default-open="isChildActive(item)"
      >
        <SidebarMenuItem>
          <SidebarMenuButton as-child :is-active="isActive(item)" :tooltip="item.label">
            <RouterLink :to="{ name: item.name, params: props.params }">
              <component :is="item.icon" />
              <span>{{ item.label }}</span>
            </RouterLink>
          </SidebarMenuButton>
          <SidebarMenuBadge
            v-if="props.badges?.[item.name]"
            :class="
              cn(
                'top-1.5',
                props.badges[item.name]!.urgent
                  ? 'bg-destructive/15 text-destructive'
                  : 'text-muted-foreground',
              )
            "
            :title="props.badges[item.name]!.label"
          >
            <span class="tabular">{{ props.badges[item.name]!.count }}</span>
          </SidebarMenuBadge>
          <template v-if="item.children?.length">
            <CollapsibleTrigger as-child>
              <SidebarMenuAction class="data-[state=open]:rotate-90">
                <ChevronRight />
                <span class="sr-only">Show {{ item.label }} pages</span>
              </SidebarMenuAction>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem v-for="child in item.children" :key="child.name">
                  <SidebarMenuSubButton as-child :is-active="route.name === child.name">
                    <RouterLink :to="{ name: child.name, params: props.params }">
                      <span>{{ child.label }}</span>
                    </RouterLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </template>
        </SidebarMenuItem>
      </Collapsible>
    </SidebarMenu>
  </SidebarGroup>
</template>
