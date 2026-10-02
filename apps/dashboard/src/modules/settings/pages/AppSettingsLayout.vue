<script setup lang="ts">
import { Lock } from "@lucide/vue";
import { RouterLink, RouterView } from "vue-router";
import { cn } from "@/lib/utils";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { hasAppRole } from "@/shared/lib/roles";
import { RouteName, type RouteNameValue } from "@/shared/router/route-names";

const { app, role } = useCurrentApp();

const SECTIONS: { name: RouteNameValue; label: string; adminOnly: boolean }[] = [
  { name: RouteName.appGeneral, label: "General", adminOnly: false },
  { name: RouteName.appPermissions, label: "Access", adminOnly: true },
  { name: RouteName.appSigning, label: "Signing", adminOnly: false },
  { name: RouteName.appCi, label: "CI", adminOnly: true },
  { name: RouteName.appConfig, label: "Remote config", adminOnly: false },
];
</script>

<template>
  <PageContainer>
    <PageHeader
      title="App settings"
      :description="app ? `${app.name} · ${app.app_id}` : undefined"
    />
    <div class="grid gap-6 md:grid-cols-[11rem_minmax(0,1fr)]">
      <nav class="flex gap-1 overflow-x-auto md:flex-col" aria-label="App settings">
        <RouterLink
          v-for="section in SECTIONS"
          :key="section.name"
          v-slot="{ href, navigate, isExactActive }"
          :to="{ name: section.name }"
          custom
        >
          <a
            :href="href"
            :class="
              cn(
                'flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm whitespace-nowrap',
                isExactActive
                  ? 'bg-accent font-medium'
                  : 'text-muted-foreground hover:bg-accent/50',
              )
            "
            @click="navigate"
          >
            {{ section.label }}
            <Lock
              v-if="section.adminOnly && !hasAppRole(role, 'admin')"
              class="size-3"
              aria-label="Admin only"
            />
          </a>
        </RouterLink>
      </nav>
      <div class="min-w-0 space-y-6">
        <RouterView />
      </div>
    </div>
  </PageContainer>
</template>
