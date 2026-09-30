<script setup lang="ts">
import { ChevronsUpDown, KeyRound, LogOut, Monitor, Moon, Sun, UserRound } from "@lucide/vue";
import { useColorMode } from "@vueuse/core";
import { computed } from "vue";
import { useRouter } from "vue-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useSession } from "../../composables/useSession";
import { useSignOut } from "../../composables/useSignOut";
import { RouteName } from "../../router/route-names";

const router = useRouter();
const { user, isInstanceAdmin } = useSession();
const signOut = useSignOut();
const { store: mode } = useColorMode({ storageKey: "capuchoo.theme" });

const initials = computed(() => {
  const source = user.value?.full_name || user.value?.email || "?";
  return source
    .split(/[\s@.]+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
});
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent">
            <span
              class="bg-muted grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold"
              >{{ initials }}</span
            >
            <div class="grid flex-1 text-left leading-tight">
              <span class="truncate text-sm font-medium">{{ user?.full_name || user?.email }}</span>
              <span class="text-muted-foreground truncate text-xs">
                {{ isInstanceAdmin ? "Instance admin" : user?.email }}
              </span>
            </div>
            <ChevronsUpDown class="ml-auto size-4 opacity-60" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="min-w-56" side="top" align="start">
          <DropdownMenuLabel class="text-muted-foreground truncate text-xs">{{
            user?.email
          }}</DropdownMenuLabel>
          <DropdownMenuItem @select="router.push({ name: RouteName.account })">
            <UserRound class="size-4" />
            Profile and password
          </DropdownMenuItem>
          <DropdownMenuItem @select="router.push({ name: RouteName.apiKeys })">
            <KeyRound class="size-4" />
            API keys
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel class="text-muted-foreground text-xs">Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup v-model="mode">
            <DropdownMenuRadioItem value="auto">
              <Monitor class="size-4" />
              System
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="light">
              <Sun class="size-4" />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon class="size-4" />
              Dark
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem :disabled="signOut.isPending.value" @select="signOut.mutate()">
            <LogOut class="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
