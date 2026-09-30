<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useCurrentApp } from "../../composables/useCurrentApp";
import { RouteName } from "../../router/route-names";

const route = useRoute();
const { app } = useCurrentApp();

const title = computed(() => {
  for (const record of [...route.matched].reverse())
    if (record.meta.title) return record.meta.title;
  return "";
});
const section = computed(() => {
  for (const record of [...route.matched].reverse())
    if (record.meta.section) return record.meta.section;
  return null;
});
</script>

<template>
  <Breadcrumb>
    <BreadcrumbList>
      <template v-if="app">
        <BreadcrumbItem class="hidden md:inline-flex">
          <BreadcrumbLink as-child>
            <RouterLink :to="{ name: RouteName.canvas, params: { appId: app.id } }">{{
              app.name
            }}</RouterLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator class="hidden md:block" />
      </template>
      <template v-if="section">
        <BreadcrumbItem class="hidden md:inline-flex">
          <span class="text-muted-foreground">{{ section }}</span>
        </BreadcrumbItem>
        <BreadcrumbSeparator class="hidden md:block" />
      </template>
      <BreadcrumbItem>
        <BreadcrumbPage>{{ title }}</BreadcrumbPage>
      </BreadcrumbItem>
    </BreadcrumbList>
  </Breadcrumb>
</template>
