<script setup lang="ts">
import { Check, ChevronsUpDown } from "@lucide/vue";
import { useRouter } from "vue-router";
import logo from "@/assets/images/capuchoo.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useCurrentOrganization } from "../../composables/useCurrentOrganization";
import { RouteName } from "../../router/route-names";

const router = useRouter();
const { organization, organizations, select } = useCurrentOrganization();

function choose(id: string) {
  select(id);
  void router.push({ name: RouteName.apps });
}
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent">
            <img :src="logo" alt="" class="size-8 shrink-0 rounded-md object-contain" />
            <div class="grid flex-1 text-left leading-tight">
              <span class="truncate text-sm font-semibold">Capuchoo</span>
              <span class="text-muted-foreground truncate text-xs">{{
                organization?.name ?? "No organization"
              }}</span>
            </div>
            <ChevronsUpDown class="ml-auto size-4 opacity-60" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="min-w-60" align="start">
          <DropdownMenuLabel class="text-muted-foreground text-xs">Organizations</DropdownMenuLabel>
          <DropdownMenuItem v-for="org in organizations" :key="org.id" @select="choose(org.id)">
            <span class="flex-1 truncate">{{ org.name }}</span>
            <span class="text-muted-foreground text-xs">{{ org.role }}</span>
            <Check v-if="org.id === organization?.id" class="size-4" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
