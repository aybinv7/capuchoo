<script setup lang="ts">
import { Compass } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import EmptyState from "../components/EmptyState.vue";
import { RouteName } from "../router/route-names";
</script>

<template>
  <div class="grid min-h-svh place-items-center p-6">
    <EmptyState
      :icon="Compass"
      title="Nothing here"
      description="The address does not match any page of the dashboard."
      class="max-w-md"
    >
      <Button as-child>
        <RouterLink :to="{ name: RouteName.apps }">Go to apps</RouterLink>
      </Button>
    </EmptyState>
  </div>
</template>
