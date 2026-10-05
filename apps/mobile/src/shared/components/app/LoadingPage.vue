<template>
  <F7Page class="cap-page" no-navbar>
    <div class="grid h-full place-items-center">
      <LoadingIndicator contained :size="56" :label="t('live.syncing')" />
    </div>
  </F7Page>
</template>

<script setup lang="ts">
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";

/** The frame between choosing an app and its row being read, a few milliseconds long. */
const { t } = useI18n();
</script>
