<template>
  <F7Page class="cap-page">
    <F7Navbar large :title="t('builds.title')" class="navbar-gradient">
      <template #left><AppSwitchButton /></template>
      <template #right><TopBarActions /></template>
    </F7Navbar>

    <template #fixed>
      <PullToRefresh :tables="[]" :action="refresh" />
    </template>

    <div v-if="!release" class="grid place-items-center py-24">
      <LoadingIndicator contained :size="56" :label="t('live.syncing')" />
    </div>

    <template v-else>
      <div class="flex flex-col gap-3 px-4 pt-1">
        <PhoneCard
          v-if="!can.seeReleases(release.app)"
          :status="release.phone"
          :can-install="phone.canInstall.value"
          :job="phone.job.value"
          class="mb-3"
          @install="phone.installTarget"
          @cancel="phone.cancelTarget"
          @open="phone.openOnPhone"
        />
        <F7Segmented strong round>
          <F7Button :active="kind === 'native'" @click="setKind('native')">
            {{ t("builds.native", { count: release.natives.length }) }}
          </F7Button>
          <F7Button :active="kind === 'ota'" @click="setKind('ota')">
            {{ t("builds.ota", { count: release.bundles.length }) }}
          </F7Button>
        </F7Segmented>

        <div v-if="flavours.length > 1" class="flavour-chips" role="group">
          <F7Chip
            :text="t('builds.allFlavours')"
            :outline="flavour !== null"
            :class="{ 'chip-selected': flavour === null }"
            @click="setFlavour(null)"
          />
          <F7Chip
            v-for="option in flavours"
            :key="option"
            :text="option"
            :outline="flavour !== option"
            :class="{ 'chip-selected': flavour === option }"
            @click="setFlavour(option)"
          />
        </div>
      </div>

      <template v-if="kind === 'native'">
        <F7List v-if="natives.length" strong inset dividers media-list class="mt-4! rounded-2xl!">
          <BuildListItem
            v-for="build in visibleNatives"
            :key="build.id"
            :build="build"
            :href="`/builds/${build.id}/`"
            :installed="installedCodes.has(build.version_code)"
          />
          <F7ListButton v-if="natives.length > limit" @click="limit += PAGE">
            {{ t("builds.more", { count: natives.length - limit }) }}
          </F7ListButton>
        </F7List>
        <EmptyState
          v-else
          icon="inventory_2"
          shape="clover4"
          :title="t('builds.noNativeTitle')"
          :text="t('builds.noNativeText')"
        />
      </template>

      <template v-else>
        <F7List v-if="bundles.length" strong inset dividers media-list class="mt-4! rounded-2xl!">
          <BundleListItem v-for="bundle in visibleBundles" :key="bundle.id" :bundle="bundle" />
          <F7ListButton v-if="bundles.length > limit" @click="limit += PAGE">
            {{ t("builds.more", { count: bundles.length - limit }) }}
          </F7ListButton>
        </F7List>
        <EmptyState
          v-else
          icon="bolt"
          shape="sunny"
          :title="t('builds.noOtaTitle')"
          :text="t('builds.noOtaText')"
        />
      </template>
    </template>
  </F7Page>
</template>

<script setup lang="ts">
import EmptyState from "@/shared/components/app/EmptyState.vue";
import AppSwitchButton from "@/shared/components/navigation/AppSwitchButton.vue";
import TopBarActions from "@/shared/components/navigation/TopBarActions.vue";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import PullToRefresh from "@/shared/components/refresh/PullToRefresh.vue";
import { can } from "@/shared/access/capabilities";
import BuildListItem from "@/shared/components/release/BuildListItem.vue";
import PhoneCard from "@/shared/components/release/PhoneCard.vue";
import { useAppRelease } from "@/shared/composables/release/useAppRelease";
import { usePhoneActions } from "@/shared/composables/release/usePhoneActions";
import BundleListItem from "../components/BundleListItem.vue";
import { useBuildFilters } from "../composables/useBuildFilters";

/**
 * Every native build and OTA bundle of the app, newest first, narrowed by flavour. For a tester or
 * a viewer it is the first tab, so it opens on this phone's state.
 */
const PAGE = 30;

const { t } = useI18n();
const { release, refresh } = useAppRelease();
/** Without the dashboard, the phone card leads here: it is what a tester opens the app for. */
const phone = usePhoneActions(release);
const { kind, flavour, flavours, natives, bundles, setKind, setFlavour } = useBuildFilters(release);

const limit = ref(PAGE);
watch([kind, flavour], () => (limit.value = PAGE));

const visibleNatives = computed(() => natives.value.slice(0, limit.value));
const visibleBundles = computed(() => bundles.value.slice(0, limit.value));
const installedCodes = computed(
  () =>
    new Set(
      (release.value?.installed ?? [])
        .filter((row) => row.installed)
        .map((row) => row.version_code),
    ),
);
</script>

<style scoped>
.flavour-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.flavour-chips :deep(.chip) {
  flex-shrink: 0;
  text-transform: capitalize;
}

.flavour-chips :deep(.chip-selected) {
  --f7-chip-bg-color: var(--secondary);
  --f7-chip-text-color: var(--secondary-foreground);
}
</style>
