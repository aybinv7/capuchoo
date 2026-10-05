<template>
  <F7Sheet
    class="people-sheet"
    :opened="Boolean(person)"
    swipe-to-close
    backdrop
    close-by-backdrop-click
    @sheet:closed="emit('close')"
  >
    <div class="swipe-handler" />
    <F7PageContent v-if="person" class="people-sheet-content">
      <header class="flex items-center gap-4 px-6 pt-1 pb-3">
        <AppIcon :name="person.name" :bundle-id="person.email" shape="circle" :size="52" />
        <div class="min-w-0">
          <p class="m-0 truncate text-[22px] leading-7 font-semibold">{{ person.name }}</p>
          <p class="m-0 truncate text-sm text-muted-foreground">{{ person.email }}</p>
        </div>
      </header>

      <F7BlockTitle class="mt-2!">{{
        person.role ? t("people.changeRole") : t("people.chooseRole", { app: appName })
      }}</F7BlockTitle>
      <RoleOptions v-model="role" :roles="APP_ROLE_ORDER" name="person-role" />

      <div class="flex flex-col gap-2 px-4 pt-2">
        <F7Button
          large
          fill
          round
          class="font-semibold!"
          :class="{ disabled: busy || !changed }"
          @click="save"
        >
          {{ person.role ? t("people.save") : t("people.give", { role: t(`roles.name.${role}`) }) }}
        </F7Button>
        <F7Button
          v-if="person.role"
          large
          round
          class="people-remove font-semibold!"
          :class="{ disabled: busy }"
          @click="remove"
        >
          {{ t("people.remove") }}
        </F7Button>
      </div>
    </F7PageContent>
  </F7Sheet>
</template>

<script setup lang="ts">
import { APP_ROLE_ORDER } from "@capuchoo/core";
import AppIcon from "@/shared/components/app/AppIcon.vue";
import RoleOptions from "@/shared/components/app/RoleOptions.vue";
import type { AppRole } from "@/shared/database/schema";
import type { Person } from "../composables/usePeople";

/**
 * One person's role on the app: change it, take it away, or - for an organization member with
 * none - give one. The parent runs the request; this only chooses.
 */
const props = defineProps<{ person: Person | null; appName: string; busy: boolean }>();
const emit = defineEmits<{ close: []; save: [role: AppRole]; remove: [] }>();
const { t } = useI18n();

const role = ref<AppRole>("tester");
watch(
  () => props.person,
  (person) => {
    if (person) role.value = person.role ?? "tester";
  },
  { immediate: true },
);

const changed = computed(() => role.value !== props.person?.role);

function save(): void {
  if (changed.value) emit("save", role.value);
}

function remove(): void {
  emit("remove");
}
</script>

<style>
.people-sheet.sheet-modal {
  height: auto;
  max-height: 90vh;
}

.people-sheet .people-sheet-content {
  max-height: calc(90vh - 28px);
  padding-bottom: calc(var(--f7-safe-area-bottom) + 20px);
}

.people-sheet .people-remove {
  --f7-button-text-color: var(--destructive);
}
</style>
