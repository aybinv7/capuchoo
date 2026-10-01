<template>
  <F7Page class="cap-page" ptr @ptr:refresh="onRefresh">
    <F7Navbar large :title="t('apps.title')" class="navbar-gradient">
      <F7NavRight><LiveIndicator /></F7NavRight>
    </F7Navbar>

    <div class="flex flex-col gap-4 px-4 pt-1">
      <SearchBar v-model="search" :placeholder="t('apps.search')" :clear-label="t('common.clear')" />

      <Transition name="cap-fade">
        <section v-if="behind.length && !search" class="attention" :aria-label="t('apps.attentionTitle')">
          <div class="flex items-center gap-3">
            <MaterialShape shape="sunny" class="grid size-11 shrink-0 place-items-center bg-primary text-primary-foreground">
              <F7Icon md="material:system_update" size="22" />
            </MaterialShape>
            <div class="min-w-0">
              <p class="text-base font-semibold">{{ t("apps.attentionTitle", { count: behind.length }, behind.length) }}</p>
              <p class="text-sm opacity-80">{{ t("apps.attentionText") }}</p>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <a v-for="summary in behind" :key="summary.app.id" :href="`/apps/${summary.app.id}/`" class="attention-chip">
              {{ summary.app.name }}
              <span class="cap-mono opacity-80">→ {{ summary.phone.target?.version_name }}</span>
            </a>
          </div>
        </section>
      </Transition>

      <div v-if="loading && !summaries.length" class="grid place-items-center py-16">
        <LoadingIndicator contained :size="56" :label="t('live.syncing')" />
      </div>

      <EmptyState
        v-else-if="!summaries.length"
        :icon="search ? 'search_off' : 'apps'"
        :title="search ? t('apps.noMatch') : t('apps.emptyTitle')"
        :text="search ? undefined : t('apps.emptyText')"
      >
        <F7Button v-if="!search" tonal round class="w-auto! px-6!" @click="onRefresh()">{{ t("common.refresh") }}</F7Button>
      </EmptyState>

      <AppCard v-for="(summary, index) in summaries" :key="summary.app.id" :summary="summary" :index="index" />

      <p v-if="lastError" class="px-2 text-center text-xs text-destructive">{{ lastError }}</p>
    </div>
  </F7Page>
</template>

<script setup lang="ts">
import EmptyState from "@/shared/components/app/EmptyState.vue";
import LiveIndicator from "@/shared/components/app/LiveIndicator.vue";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import { useSync } from "@/shared/sync/useSync";
import AppCard from "../components/AppCard.vue";
import SearchBar from "../components/SearchBar.vue";
import { useAppsOverview } from "../composables/useAppsOverview";

const { t } = useI18n();
const search = ref("");
const { summaries, behind, loading } = useAppsOverview(search);
const { refresh, lastError } = useSync();

function onRefresh(done?: () => void): void {
  refresh().finally(() => done?.());
}
</script>

<style scoped>
.attention {
  padding: 16px;
  border-radius: var(--radius-xl);
  background: var(--primary-container);
  color: var(--primary-container-foreground);
}

.attention-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding-inline: 12px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--card) 75%, transparent);
  color: var(--foreground);
  font-size: 13px;
  font-weight: 600;
}
</style>
