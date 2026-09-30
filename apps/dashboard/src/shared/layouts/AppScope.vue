<script setup lang="ts">
import { SearchX } from "@lucide/vue";
import { RouterLink, RouterView } from "vue-router";
import { Button } from "@/components/ui/button";
import EmptyState from "../components/EmptyState.vue";
import { useCurrentApp } from "../composables/useCurrentApp";
import { useAppStream } from "../live/useAppStream";
import { RouteName } from "../router/route-names";

const { app, appId } = useCurrentApp();

useAppStream(() => (app.value ? appId.value : null));
</script>

<template>
  <RouterView v-if="app" />
  <div v-else class="mx-auto w-full max-w-xl p-6">
    <EmptyState
      :icon="SearchX"
      title="App not found"
      description="It does not exist, or your role does not reach it."
    >
      <Button as-child variant="outline">
        <RouterLink :to="{ name: RouteName.apps }">All apps</RouterLink>
      </Button>
    </EmptyState>
  </div>
</template>
