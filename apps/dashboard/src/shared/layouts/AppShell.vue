<script setup lang="ts">
import { RouterView } from "vue-router";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import ErrorNotice from "../components/ErrorNotice.vue";
import LiveIndicator from "../components/LiveIndicator.vue";
import { useCurrentApp } from "../composables/useCurrentApp";
import { useSession } from "../composables/useSession";
import AppSidebar from "./components/AppSidebar.vue";
import ShellBreadcrumb from "./components/ShellBreadcrumb.vue";

const { error, refetch, me } = useSession();
const { appId } = useCurrentApp();
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset class="min-w-0">
      <header
        class="bg-background/85 sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b px-3 backdrop-blur"
      >
        <SidebarTrigger class="-ml-1" />
        <Separator orientation="vertical" class="mr-1 data-[orientation=vertical]:h-4" />
        <ShellBreadcrumb />
        <div class="ml-auto flex items-center gap-2">
          <LiveIndicator v-if="appId" />
        </div>
      </header>
      <div v-if="error && !me" class="mx-auto w-full max-w-xl p-6">
        <ErrorNotice :error="error" :retry="refetch" />
      </div>
      <RouterView v-else />
    </SidebarInset>
  </SidebarProvider>
</template>
