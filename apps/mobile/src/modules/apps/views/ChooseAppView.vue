<template>
  <F7Page class="cap-page cap-pushed choose-page" no-navbar>
    <template #fixed>
      <PullToRefresh :tables="[]" :action="refresh" />
    </template>

    <header class="flex flex-col gap-3 px-6 pt-[calc(var(--f7-safe-area-top)+40px)] pb-2">
      <div class="choose-mark" aria-hidden="true">
        <MaterialShape shape="cookie9" class="mark-a bg-tone-1" />
        <MaterialShape shape="sunny" class="mark-b bg-primary" />
        <MaterialShape shape="clover4" class="mark-c bg-tone-4" />
      </div>
      <h1 class="m-0 text-[32px] leading-10 font-bold tracking-tight">{{ t("choose.title") }}</h1>
      <p class="m-0 text-base leading-6 text-muted-foreground">{{ t("choose.subtitle") }}</p>
    </header>

    <div v-if="choices.length > SEARCH_FROM" class="px-4 pt-3">
      <F7Searchbar
        inline
        custom-search
        :outline="false"
        :backdrop="false"
        :disable-button="false"
        :placeholder="t('choose.search')"
        :value="search"
        @update:value="search = String($event ?? '')"
        @searchbar:clear="search = ''"
      />
    </div>

    <template v-if="groups.length">
      <template v-for="group in groups" :key="group.name">
        <F7BlockTitle>{{ group.name }}</F7BlockTitle>
        <F7List strong inset dividers media-list class="rounded-2xl!">
          <AppPickerItem
            v-for="choice in group.choices"
            :key="choice.app.id"
            :choice="choice"
            @select="choose(choice.app.id)"
          />
        </F7List>
      </template>
    </template>

    <div v-else-if="syncing || loading" class="grid place-items-center py-16">
      <LoadingIndicator contained :size="56" :label="t('choose.loading')" />
    </div>

    <EmptyState
      v-else
      :icon="search ? 'search_off' : 'apps'"
      :title="search ? t('choose.noMatch', { term: search.trim() }) : t('choose.emptyTitle')"
      :text="search ? undefined : (lastError ?? t('choose.emptyText'))"
    >
      <F7Button v-if="!search" tonal round class="w-auto! px-6!" @click="refresh()">{{
        t("common.refresh")
      }}</F7Button>
    </EmptyState>

    <F7List strong inset class="mt-8! rounded-2xl!">
      <F7ListButton class="list-button-danger" :class="{ disabled: signingOut }" @click="signOut">
        {{ t("choose.signOut") }}
      </F7ListButton>
    </F7List>
  </F7Page>
</template>

<script setup lang="ts">
import AppPickerItem from "@/shared/components/app/AppPickerItem.vue";
import EmptyState from "@/shared/components/app/EmptyState.vue";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import PullToRefresh from "@/shared/components/refresh/PullToRefresh.vue";
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import { useAppList, type AppChoice } from "@/shared/composables/release/useAppList";
import { selectApp } from "@/shared/session/currentApp";
import { syncInsights } from "@/shared/sync/insights";
import { signOut as endAccountSession, useSync } from "@/shared/sync/useSync";
import { bump } from "@/shared/utils/native/haptics";

/**
 * The one choice after sign-in: which app to work on. Everything after it is that app's, and the
 * top bar switches it, so this page is seen once - or again when the account loses the app.
 */
const SEARCH_FROM = 6;

const { t } = useI18n();
const { choices, loading } = useAppList();
const { syncing, lastError, refresh } = useSync();

const search = ref("");
const signingOut = ref(false);

const groups = computed(() => {
  const term = search.value.trim().toLowerCase();
  const byOrg = new Map<string, AppChoice[]>();
  for (const choice of choices.value) {
    if (
      term &&
      !choice.app.name.toLowerCase().includes(term) &&
      !choice.app.bundle_id.toLowerCase().includes(term)
    )
      continue;
    const name = choice.organization ?? t("choose.noOrganization");
    byOrg.set(name, [...(byOrg.get(name) ?? []), choice]);
  }
  return [...byOrg.entries()].map(([name, list]) => ({ name, choices: list }));
});

function choose(appId: string): void {
  bump();
  selectApp(appId);
  void syncInsights(appId).catch(() => undefined);
}

async function signOut(): Promise<void> {
  if (signingOut.value) return;
  signingOut.value = true;
  try {
    await endAccountSession();
  } finally {
    signingOut.value = false;
  }
}
</script>

<style scoped>
.choose-mark {
  position: relative;
  width: 88px;
  height: 64px;
}

.choose-mark > * {
  position: absolute;
  animation: mark-in 700ms var(--ease-spring-fast) both;
}

.mark-a {
  inset-inline-start: 0;
  top: 8px;
  width: 48px;
  height: 48px;
}

.mark-b {
  inset-inline-start: 30px;
  top: 0;
  width: 36px;
  height: 36px;
  animation-delay: 90ms;
}

.mark-c {
  inset-inline-start: 52px;
  top: 28px;
  width: 32px;
  height: 32px;
  animation-delay: 180ms;
}

@keyframes mark-in {
  from {
    transform: scale(0.2) rotate(-120deg);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .choose-mark > * {
    animation: none;
  }
}
</style>
