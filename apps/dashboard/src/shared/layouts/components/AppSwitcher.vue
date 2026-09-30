<script setup lang="ts">
import { ChevronsUpDown, LayoutGrid } from "@lucide/vue";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useCurrentApp } from "../../composables/useCurrentApp";
import { useSession } from "../../composables/useSession";
import { RouteName } from "../../router/route-names";

const route = useRoute();
const router = useRouter();
const { app } = useCurrentApp();
const { apps } = useSession();

const siblings = computed(() =>
  apps.value.filter((entry) => entry.organization_id === app.value?.organization_id),
);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Same page on another app, unless the page is about one entity of this app. */
function open(appId: string) {
  const entityPage = route.name === RouteName.channel || route.name === RouteName.build;
  const name = entityPage || typeof route.name !== "string" ? RouteName.canvas : route.name;
  void router.push({ name, params: { appId } });
}
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="border-sidebar-border bg-background/40 data-[state=open]:bg-sidebar-accent border"
          >
            <span
              class="bg-primary/10 text-primary grid size-7 shrink-0 place-items-center rounded font-mono text-[11px] font-semibold"
              >{{ initials(app?.name ?? "?") }}</span
            >
            <div class="grid flex-1 text-left leading-tight">
              <span class="truncate text-sm font-medium">{{ app?.name }}</span>
              <span class="text-muted-foreground truncate font-mono text-[11px]">{{
                app?.app_id
              }}</span>
            </div>
            <ChevronsUpDown class="ml-auto size-4 opacity-60" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="min-w-64" align="start">
          <DropdownMenuLabel class="text-muted-foreground text-xs">Apps</DropdownMenuLabel>
          <DropdownMenuItem
            v-for="entry in siblings"
            :key="entry.id"
            :disabled="entry.id === app?.id"
            @select="open(entry.id)"
          >
            <div class="grid flex-1 leading-tight">
              <span class="truncate">{{ entry.name }}</span>
              <span class="text-muted-foreground truncate font-mono text-[11px]">{{
                entry.app_id
              }}</span>
            </div>
            <span class="text-muted-foreground text-xs">{{ entry.role }}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @select="router.push({ name: RouteName.apps })">
            <LayoutGrid class="size-4" />
            All apps
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
