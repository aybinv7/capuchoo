<template>
  <F7ListItem link="#" :no-chevron="true" @click="onClick">
    <template #media>
      <AppIcon
        :name="choice.app.name"
        :bundle-id="choice.app.bundle_id"
        :icon-url="choice.app.icon_url"
        :size="48"
      />
    </template>
    <template #title>
      <span class="font-semibold">{{ choice.app.name }}</span>
    </template>
    <template #after>
      <F7Icon v-if="current" md="material:check_circle" size="24" class="text-primary" />
      <span v-else class="text-xs">{{ t(`roles.name.${choice.app.role}`) }}</span>
    </template>
    <template #subtitle>
      <span class="text-[13px]">{{ subtitle }}</span>
    </template>
    <template #text>
      <LaneDots :lanes="choice.lanes" />
    </template>
  </F7ListItem>
</template>

<script setup lang="ts">
import AppIcon from "@/shared/components/app/AppIcon.vue";
import LaneDots from "@/shared/components/release/LaneDots.vue";
import type { AppChoice } from "@/shared/composables/release/useAppList";
import { tick } from "@/shared/utils/native/haptics";

/** One app to work on: who owns it, the role held there, and where each release stands. */
const props = defineProps<{ choice: AppChoice; current?: boolean }>();
const emit = defineEmits<{ select: [] }>();
const { t } = useI18n();

const subtitle = computed(() =>
  [props.choice.organization, props.choice.app.bundle_id].filter(Boolean).join(" · "),
);

function onClick(): void {
  tick();
  emit("select");
}
</script>
