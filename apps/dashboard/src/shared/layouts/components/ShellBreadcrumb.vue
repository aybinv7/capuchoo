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
import { useBreadcrumbClaim } from "../composables/useBreadcrumbLabel";

const route = useRoute();
const { app } = useCurrentApp();
const claimed = useBreadcrumbClaim();

function nearest<K extends "title" | "section" | "parent">(key: K) {
  for (const record of [...route.matched].reverse()) {
    const value = record.meta[key];
    if (value) return value;
  }
  return undefined;
}

const title = computed(() => claimed.value ?? nearest("title") ?? "");
const section = computed(() => nearest("section") ?? null);
const parent = computed(() => nearest("parent") ?? null);
</script>

<template>
  <Breadcrumb class="min-w-0">
    <BreadcrumbList class="flex-nowrap">
      <template v-if="app">
        <BreadcrumbItem class="hidden md:inline-flex">
          <BreadcrumbLink as-child>
            <RouterLink :to="{ name: RouteName.overview, params: { appId: app.id } }">{{
              app.name
            }}</RouterLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator class="hidden md:block" />
      </template>
      <template v-if="section">
        <BreadcrumbItem :class="parent ? 'shrink-0' : 'hidden md:inline-flex'">
          <BreadcrumbLink v-if="parent" as-child>
            <RouterLink :to="{ name: parent }">{{ section }}</RouterLink>
          </BreadcrumbLink>
          <span v-else class="text-muted-foreground">{{ section }}</span>
        </BreadcrumbItem>
        <BreadcrumbSeparator :class="parent ? undefined : 'hidden md:block'" />
      </template>
      <BreadcrumbItem class="min-w-0">
        <BreadcrumbPage class="block max-w-[40ch] truncate" :title="title">{{
          title
        }}</BreadcrumbPage>
      </BreadcrumbItem>
    </BreadcrumbList>
  </Breadcrumb>
</template>
