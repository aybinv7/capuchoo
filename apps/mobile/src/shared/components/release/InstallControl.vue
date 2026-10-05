<template>
  <div class="flex flex-col gap-2">
    <template v-if="active">
      <div class="flex items-center gap-3">
        <LoadingIndicator v-if="job!.phase !== 'downloading'" :size="32" :label="phaseLabel" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold">{{ phaseLabel }}</p>
          <p v-if="job!.phase === 'downloading'" class="cap-mono text-xs text-muted-foreground">
            {{ formatBytes(job!.bytes) }} / {{ formatBytes(job!.total) }}
          </p>
        </div>
        <F7Button
          v-if="job!.phase === 'downloading'"
          tonal
          round
          small
          class="w-auto!"
          @click="emit('cancel')"
        >
          {{ t("install.cancel") }}
        </F7Button>
      </div>
      <WavyProgress v-if="job!.phase === 'downloading'" :progress="fraction" :label="phaseLabel" />
    </template>

    <template v-else>
      <Transition name="cap-fade">
        <p
          v-if="job?.phase === 'failed'"
          role="alert"
          class="rounded-md bg-destructive-container px-3 py-2 text-sm text-destructive-container-foreground"
        >
          {{ job.error }}
        </p>
      </Transition>
      <F7Button
        :fill="primary"
        :tonal="!primary"
        round
        :large="large"
        class="font-semibold!"
        :class="large ? 'h-14! text-base!' : ''"
        :disabled="disabled"
        @click="emit('install')"
      >
        <F7Icon :md="`material:${icon}`" size="20" class="me-2" />
        {{ label }}
      </F7Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import WavyProgress from "@/shared/components/progress/WavyProgress.vue";
import { formatBytes } from "@/shared/utils/format";
import type { InstallJob } from "@/shared/composables/release/useInstaller";

/** One build's install action: the button, then its progress, then what went wrong if anything did. */
const props = withDefaults(
  defineProps<{
    job?: InstallJob;
    label: string;
    icon?: string;
    primary?: boolean;
    large?: boolean;
    disabled?: boolean;
  }>(),
  { job: undefined, icon: "download", primary: true, large: false, disabled: false },
);
const emit = defineEmits<{ install: []; cancel: [] }>();
const { t } = useI18n();

const active = computed(() => Boolean(props.job && !["done", "failed"].includes(props.job.phase)));
const fraction = computed(() => (props.job?.total ? props.job.bytes / props.job.total : 0));
const phaseLabel = computed(() => (props.job ? t(`install.phase.${props.job.phase}`) : ""));
</script>
