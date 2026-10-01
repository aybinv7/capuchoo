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
    <template #after>
      <span class="text-xs">{{ t(`roles.name.${summary.app.role}`) }}</span>
    </template>
    <template #subtitle>
      <PhoneLine :status="summary.phone" class="text-[13px]" />
    </template>
    <template #text>
      <LaneDots :lanes="summary.lanes" />
    </template>
  </F7ListItem>
</template>

<script setup lang="ts">
import AppIcon from "@/shared/components/app/AppIcon.vue";
import { tick } from "@/shared/utils/native/haptics";
import type { AppSummary } from "../composables/useAppsOverview";
import LaneDots from "./LaneDots.vue";
import PhoneLine from "./PhoneLine.vue";

defineProps<{ summary: AppSummary }>();
const { t } = useI18n();
</script>
