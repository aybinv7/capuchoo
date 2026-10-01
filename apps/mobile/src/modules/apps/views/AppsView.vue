<template>
  <F7Page class="cap-page">
    <F7Navbar large :title="t('apps.title')" class="navbar-gradient">
      <F7NavRight><LiveIndicator /></F7NavRight>
    </F7Navbar>

    <template #fixed>
      <PullToRefresh :tables="TABLES" :action="refresh" />
    </template>

    <div class="px-4 pt-1">
      <F7Searchbar
        inline
        custom-search
        :outline="false"
        :backdrop="false"
        :disable-button="false"
        :placeholder="t('apps.search')"
        :value="search"
        @update:value="search = String($event ?? '')"
        @searchbar:clear="search = ''"
      />
    </div>

    <template v-if="behind.length && !search">
      <F7BlockTitle>{{
        t("apps.updatesTitle", { count: behind.length }, behind.length)
      }}</F7BlockTitle>
      <F7List strong inset dividers media-list class="rounded-2xl!">
        <UpdateListItem
          v-for="summary in behind"
          :key="summary.app.id"
          :summary="summary"
          :job="summary.target ? jobFor(summary.target.id) : undefined"
          :can-install="canInstall(summary)"
          @update="update(summary)"
        />
      </F7List>
    </template>

    <template v-if="summaries.length">
      <F7BlockTitle>{{
        search ? t("apps.results", { count: summaries.length }, summaries.length) : t("apps.all")
      }}</F7BlockTitle>
      <F7List strong inset dividers media-list class="rounded-2xl!">
        <AppListItem v-for="summary in summaries" :key="summary.app.id" :summary="summary" />
      </F7List>
      <F7BlockFooter v-if="lastError" class="text-destructive!">{{ lastError }}</F7BlockFooter>
    </template>

    <div v-else-if="loading" class="grid place-items-center py-16">
      <LoadingIndicator contained :size="56" :label="t('live.syncing')" />
    </div>

    <EmptyState
      v-else
      :icon="search ? 'search_off' : 'apps'"
      :title="search ? t('apps.noMatch', { term: search.trim() }) : t('apps.emptyTitle')"
      :text="search ? undefined : (lastError ?? t('apps.emptyText'))"
    >
      <F7Button v-if="!search" tonal round class="w-auto! px-6!" @click="refresh()">{{
        t("common.refresh")
      }}</F7Button>
    </EmptyState>
  </F7Page>
</template>

<script setup lang="ts">
import { can } from "@/shared/access/capabilities";
import EmptyState from "@/shared/components/app/EmptyState.vue";
import LiveIndicator from "@/shared/components/app/LiveIndicator.vue";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import PullToRefresh from "@/shared/components/refresh/PullToRefresh.vue";
import type { Database } from "@/shared/database/schema";
import { hasDevice } from "@/shared/native/device";
import { useSync } from "@/shared/sync/useSync";
import AppListItem from "../components/AppListItem.vue";
import UpdateListItem from "../components/UpdateListItem.vue";
import { useAppsOverview, type AppSummary } from "../composables/useAppsOverview";
import { useInstaller } from "../composables/useInstaller";

const TABLES: readonly (keyof Database)[] = [
  "app",
  "channel",
  "native_build",
  "app_identifier",
  "installed",
];

const { t } = useI18n();
const search = ref("");
const { summaries, behind, loading } = useAppsOverview(search);
const { refresh, lastError } = useSync();
const { install, jobFor } = useInstaller();

function canInstall(summary: AppSummary): boolean {
  return Boolean(summary.target) && can.install(summary.app) && hasDevice();
}

function update(summary: AppSummary): void {
  if (!summary.target) return;
  void install({
    app: summary.app,
    build: summary.target,
    identifiers: summary.identifiers,
    installed: summary.installed,
  });
}
</script>
