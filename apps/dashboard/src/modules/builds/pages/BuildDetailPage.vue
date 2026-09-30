<script setup lang="ts">
import { ArrowLeft, CircleAlert } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import BuildStatusBadge from "@/shared/components/BuildStatusBadge.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useBuild } from "@/shared/queries/useBuilds";
import { useCatalog } from "@/shared/queries/useCatalog";
import { RouteName } from "@/shared/router/route-names";
import BuildEventTimeline from "../components/BuildEventTimeline.vue";
import BuildMeta from "../components/BuildMeta.vue";

const route = useRoute();
const { appId } = useCurrentApp();
const buildId = computed(() =>
  typeof route.params.buildId === "string" ? route.params.buildId : "",
);
const { data: build, isPending, error, refetch } = useBuild(buildId);
const { catalog } = useCatalog(appId);

const title = computed(() => {
  const value = build.value;
  if (!value) return "Build";
  const version = value.version_name ? ` ${value.version_name}` : "";
  return `${value.kind.toUpperCase()}${version}${value.channel_name ? ` → ${value.channel_name}` : ""}`;
});
</script>

<template>
  <PageContainer>
    <RouterLink
      :to="{ name: RouteName.builds }"
      class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft class="size-3.5" />
      Builds
    </RouterLink>

    <ErrorNotice v-if="error" :error="error" :retry="refetch" />
    <div v-else-if="isPending || !build" class="space-y-4">
      <Skeleton class="h-10 w-80" />
      <Skeleton class="h-32 w-full" />
    </div>
    <template v-else>
      <PageHeader :title="title">
        <template #badges>
          <BuildStatusBadge :status="build.status" />
        </template>
      </PageHeader>

      <Alert v-if="build.error" variant="destructive">
        <CircleAlert />
        <AlertTitle>The build reported a failure</AlertTitle>
        <AlertDescription class="font-mono text-xs whitespace-pre-wrap">{{
          build.error
        }}</AlertDescription>
      </Alert>

      <BuildMeta :build="build" :catalog="catalog" />

      <section class="bg-card rounded-lg border">
        <header class="flex items-center justify-between border-b px-4 py-2.5">
          <span class="text-muted-foreground text-xs font-medium uppercase">Steps</span>
          <span class="text-muted-foreground text-xs">{{ build.events.length }} events</span>
        </header>
        <div class="p-4">
          <p v-if="build.events.length === 0" class="text-muted-foreground text-sm">
            No step reported yet.
          </p>
          <BuildEventTimeline
            v-else
            :events="build.events"
            :started-at="build.started_at ?? build.created_at"
          />
        </div>
      </section>
    </template>
  </PageContainer>
</template>
