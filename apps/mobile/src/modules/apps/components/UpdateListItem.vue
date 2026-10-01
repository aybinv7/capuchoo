<template>
  <F7ListItem :link="`/apps/${summary.app.id}/`" @click="tick">
    <template #media>
      <AppIcon
        :name="summary.app.name"
        :bundle-id="summary.app.bundle_id"
        :icon-url="summary.app.icon_url"
        :size="48"
      />
    </template>
    <template #title>
      <span class="font-semibold">{{ summary.app.name }}</span>
    </template>
    <template #subtitle>
      <span class="cap-mono text-[13px]">
        {{ from }} <span class="text-muted-foreground">→</span>
        <span class="font-semibold text-primary">{{ to }}</span>
      </span>
    </template>
    <template #text>
      <span v-if="job?.phase === 'failed'" class="text-destructive">{{ job.error }}</span>
      <span v-else-if="job && running">{{ t(`install.phase.${job.phase}`) }}</span>
      <span v-else>{{
        t("apps.updateFrom", { channel: summary.phone.channel?.name ?? "prod" })
      }}</span>
    </template>
    <template #after>
      <LoadingIndicator
        v-if="job && running"
        :size="36"
        :progress="progress"
        :label="t(`install.phase.${job.phase}`)"
      />
      <F7Button
        v-else-if="canInstall"
        fill
        round
        small
        class="w-auto! px-4!"
        @click.stop.prevent="emit('update')"
      >
        {{ t("apps.update") }}
      </F7Button>
    </template>
  </F7ListItem>
</template>

<script setup lang="ts">
import AppIcon from "@/shared/components/app/AppIcon.vue";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import { versionLabel } from "@/shared/utils/format";
import { tick } from "@/shared/utils/native/haptics";
import type { AppSummary } from "../composables/useAppsOverview";
import type { InstallJob } from "../composables/useInstaller";

/**
 * An app this phone runs behind its channel, as Play shows a pending update: the version jump,
 * and Update at the end of the row. While it installs, the button becomes the indicator - filling
 * with the download, then morphing while Android installs.
 */
const props = defineProps<{ summary: AppSummary; job?: InstallJob; canInstall: boolean }>();
const emit = defineEmits<{ update: [] }>();
const { t } = useI18n();

const from = computed(() =>
  versionLabel(props.summary.phone.installedName, props.summary.phone.installedCode),
);
const to = computed(() =>
  versionLabel(props.summary.phone.target?.version_name, props.summary.phone.target?.version_code),
);
const running = computed(() => Boolean(props.job && !["done", "failed"].includes(props.job.phase)));
const progress = computed(() => {
  const job = props.job;
  return job?.phase === "downloading" && job.total ? job.bytes / job.total : undefined;
});
</script>
