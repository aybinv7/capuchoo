<script setup lang="ts">
import { Check, ChevronsUpDown, LayoutGrid } from "@lucide/vue";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import logo from "@/assets/images/capuchoo.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useCurrentApp } from "../../composables/useCurrentApp";
import { useCurrentOrganization } from "../../composables/useCurrentOrganization";
import { useSession } from "../../composables/useSession";
import { RouteName } from "../../router/route-names";

const route = useRoute();
const router = useRouter();
const { isMobile } = useSidebar();
const { app } = useCurrentApp();
const { apps } = useSession();
const { organization, organizations, select } = useCurrentOrganization();

const siblings = computed(() =>
  apps.value.filter((entry) => entry.organization_id === organization.value?.id),
);

const initials = (name: string) =>
  name
    .split(/[\s._-]+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** The same page on another app, unless the page is about one entity of this app. */
function openApp(appId: string) {
  const entityPage = route.name === RouteName.channel || route.name === RouteName.build;
  const name =
    app.value && !entityPage && typeof route.name === "string" ? route.name : RouteName.canvas;
  void router.push({ name, params: { appId } });
}

function openOrganization(id: string) {
  select(id);
  void router.push({ name: RouteName.apps });
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
            <div
              v-if="app"
              class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg font-mono text-xs font-semibold"
            >
              {{ initials(app.name) }}
            </div>
            <img v-else :src="logo" alt="" class="size-8 shrink-0 rounded-lg object-contain" />
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ app?.name ?? "Capuchoo" }}</span>
              <span class="text-muted-foreground truncate text-xs">
                {{ organization?.name ?? "No organization"
                }}<template v-if="app"> • {{ app.platform }}</template>
              </span>
            </div>
            <ChevronsUpDown class="ml-auto size-4 opacity-60" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-(--reka-dropdown-menu-trigger-width) min-w-64 rounded-lg"
          :side="isMobile ? 'bottom' : 'right'"
          align="start"
          :side-offset="4"
        >
          <DropdownMenuLabel class="text-muted-foreground text-xs">
            Apps in {{ organization?.name ?? "this organization" }}
          </DropdownMenuLabel>
          <DropdownMenuItem
            v-for="entry in siblings"
            :key="entry.id"
            class="gap-2 p-2"
            @select="openApp(entry.id)"
          >
            <span
              class="bg-muted flex size-6 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-semibold"
              >{{ initials(entry.name) }}</span
            >
            <div class="grid min-w-0 flex-1 leading-tight">
              <span class="truncate">{{ entry.name }}</span>
              <span class="text-muted-foreground truncate font-mono text-[11px]">{{
                entry.app_id
              }}</span>
            </div>
            <Check v-if="entry.id === app?.id" class="size-4" />
          </DropdownMenuItem>
          <DropdownMenuItem v-if="siblings.length === 0" disabled class="text-xs"
            >No app yet</DropdownMenuItem
          >
          <template v-if="organizations.length > 1">
            <DropdownMenuSeparator />
            <DropdownMenuLabel class="text-muted-foreground text-xs"
              >Organizations</DropdownMenuLabel
            >
            <DropdownMenuItem
              v-for="org in organizations"
              :key="org.id"
              class="gap-2 p-2"
              @select="openOrganization(org.id)"
            >
              <span class="flex-1 truncate">{{ org.name }}</span>
              <span class="text-muted-foreground text-xs">{{ org.role }}</span>
              <Check v-if="org.id === organization?.id" class="size-4" />
            </DropdownMenuItem>
          </template>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="gap-2 p-2" @select="router.push({ name: RouteName.apps })">
            <LayoutGrid class="size-4" />
            All apps
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
