<template>
  <F7ListItem :link="disabled ? false : '#'" :no-chevron="true" @click="onClick">
    <template #media>
      <AppIcon :name="person.name" :bundle-id="person.email" shape="circle" :size="40" />
    </template>
    <template #title>
      <span class="font-semibold">{{ person.name }}</span>
      <span v-if="self" class="ms-2 text-xs font-semibold text-primary">{{ t("people.you") }}</span>
    </template>
    <template #after>
      <span
        v-if="person.role"
        class="inline-flex h-6 items-center rounded-sm bg-secondary px-2 text-xs font-semibold text-secondary-foreground"
        >{{ t(`roles.name.${person.role}`) }}</span
      >
      <span v-else class="text-xs font-semibold text-primary">{{ t("people.giveAccess") }}</span>
    </template>
    <template v-if="person.name !== person.email" #subtitle>
      <span class="text-[13px]">{{ person.email }}</span>
    </template>
  </F7ListItem>
</template>

<script setup lang="ts">
import AppIcon from "@/shared/components/app/AppIcon.vue";
import { tick } from "@/shared/utils/native/haptics";
import type { Person } from "../composables/usePeople";

/** Someone on the team, with the role they hold here, or the offer to give them one. */
const props = defineProps<{ person: Person; self?: boolean; disabled?: boolean }>();
const emit = defineEmits<{ open: [] }>();
const { t } = useI18n();

function onClick(): void {
  if (props.disabled) return;
  tick();
  emit("open");
}
</script>
