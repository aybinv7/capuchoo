<script setup lang="ts">
import { ArrowRight, Workflow } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { RouteName } from "@/shared/router/route-names";
import { useChannelBuilds } from "../composables/useChannelBuilds";
import ChannelRunRow from "./ChannelRunRow.vue";

const props = defineProps<{ appId: string; channelId: string }>();

const query = useChannelBuilds(
  () => props.appId,
  () => props.channelId,
);
const builds = computed(() => query.data.value ?? []);
</script>

<template>
  <section class="bg-card min-w-0 rounded-lg border">
    <header class="flex items-center justify-between gap-2 border-b px-4 py-2.5">
      <span class="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase">
        <Workflow class="size-3.5" />
        Recent runs
        <Spinner
          v-if="query.isFetching.value && !query.isPending.value"
          class="size-3"
          aria-label="Refreshing"
        />
      </span>
      <RouterLink
        :to="{ name: RouteName.builds }"
        class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        All builds
        <ArrowRight class="size-3" />
      </RouterLink>
    </header>
    <div class="p-2">
      <div v-if="query.error.value && !query.data.value" class="p-2">
        <ErrorNotice :error="query.error.value" :retry="query.refetch" />
      </div>
      <div v-else-if="query.isPending.value" class="space-y-2 p-2" aria-busy="true">
        <Skeleton v-for="index in 4" :key="index" class="h-10 w-full" />
      </div>
      <p
        v-else-if="!builds.length"
        class="text-muted-foreground px-4 py-8 text-center text-sm text-pretty"
      >
        No CI run has deployed here yet.
      </p>
      <ul v-else class="divide-y">
        <li v-for="build in builds" :key="build.id">
          <ChannelRunRow :build="build" />
        </li>
      </ul>
    </div>
  </section>
</template>
