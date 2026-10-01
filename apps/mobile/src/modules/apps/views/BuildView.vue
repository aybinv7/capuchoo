<template>
  <F7Page class="cap-page">
    <F7Navbar :title="build ? build.version_name : ''" back-link class="navbar-gradient" :sliding="true" />

    <div v-if="!build || !detail" class="grid place-items-center py-24">
      <LoadingIndicator contained :size="56" :label="t('live.syncing')" />
    </div>

    <div v-else class="flex flex-col gap-6 px-4 pt-2">
      <header class="build-hero">
        <MaterialShape shape="cookie12" class="hero-shape grid size-24 place-items-center bg-primary-container text-primary-container-foreground">
          <F7Icon md="material:android" size="44" />
        </MaterialShape>
        <div class="flex flex-col items-center gap-1 text-center">
          <p class="cap-mono text-[32px] leading-10 font-bold tracking-tight">{{ build.version_name }}</p>
          <p class="cap-mono text-sm text-muted-foreground">{{ t("build.code", { code: build.version_code }) }}</p>
          <div class="mt-2 flex flex-wrap justify-center gap-1.5">
            <EnvironmentChip v-if="build.flavour" :environment="build.flavour" />
            <span v-for="channel in served" :key="channel" class="rounded-sm bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
              {{ t("build.servedBy", { channel }) }}
            </span>
          </div>
        </div>
      </header>

      <InstallControl
        v-if="canInstall"
        :job="job"
        :label="installLabel"
        :icon="installedHere ? 'refresh' : 'download'"
        :primary="!installedHere"
        large
        @install="onInstall"
        @cancel="cancel(build.id)"
      />

      <section v-if="build.release_notes" class="rounded-[20px] bg-card p-4 shadow-card">
        <h2 class="mb-2 text-sm font-semibold text-muted-foreground">{{ t("build.notes") }}</h2>
        <p class="text-base leading-6 whitespace-pre-line cap-selectable">{{ build.release_notes }}</p>
      </section>

      <F7List strong inset dividers class="m-0!">
        <F7ListItem :title="t('build.size')" :after="formatBytes(build.size_bytes)" />
        <F7ListItem :title="t('build.published')" :after="formatRelative(build.created_at, locale)" />
        <F7ListItem :title="t('build.minSdk')" :after="build.min_sdk ? `Android API ${build.min_sdk}` : '—'" />
        <F7ListItem :title="t('build.required')" :after="build.required ? t('common.yes') : t('common.no')" />
        <F7ListItem :title="t('build.signed')" :after="build.signed ? t('build.signedYes') : t('build.signedNo')" />
        <F7ListItem :title="t('build.certificate')" :after="certificate" />
        <F7ListItem :title="t('build.checksum')" :after="checksum" />
      </F7List>
    </div>
  </F7Page>
</template>

<script setup lang="ts">
import type { Router } from "framework7/types";
import { can } from "@/shared/access/capabilities";
import EnvironmentChip from "@/shared/components/app/EnvironmentChip.vue";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import { hasDevice } from "@/shared/native/device";
import { formatBytes, formatRelative, parseChannels } from "@/shared/utils/format";
import InstallControl from "../components/InstallControl.vue";
import { useAppDetail } from "../composables/useAppDetail";
import { useInstaller } from "../composables/useInstaller";

const props = defineProps<{ f7route: Router.Route; f7router: Router.Router }>();
useHiddenTabbar();
const { t, locale } = useI18n();

const appId = String(props.f7route.params.appId ?? "");
const nativeId = String(props.f7route.params.nativeId ?? "");
const { detail } = useAppDetail(appId);
const { install, cancel, jobFor } = useInstaller();

const build = computed(() => detail.value?.natives.find((native) => native.id === nativeId));
const served = computed(() => parseChannels(build.value?.channels));
const job = computed(() => jobFor(nativeId));
const canInstall = computed(() => Boolean(detail.value && can.install(detail.value.app) && hasDevice()));

const installedHere = computed(() =>
  (detail.value?.installed ?? []).some((row) => row.installed && row.version_code === build.value?.version_code),
);
const installLabel = computed(() =>
  installedHere.value ? t("build.reinstall") : t("build.install", { version: build.value?.version_name ?? "" }),
);

const shorten = (value: string | null) => (value ? `${value.slice(0, 8)}…${value.slice(-8)}` : "—");
const certificate = computed(() => shorten(build.value?.signing_cert_sha256 ?? null));
const checksum = computed(() => shorten(build.value?.checksum ?? null));

function onInstall(): void {
  if (detail.value && build.value)
    void install({ app: detail.value.app, build: build.value, identifiers: detail.value.identifiers, installed: detail.value.installed });
}
</script>

<style scoped>
.build-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding-block: 8px 4px;
}

.hero-shape {
  animation: hero-in 640ms var(--ease-spring-fast) both;
}

@keyframes hero-in {
  from {
    transform: scale(0.3) rotate(-90deg);
    opacity: 0;
  }
}
</style>
