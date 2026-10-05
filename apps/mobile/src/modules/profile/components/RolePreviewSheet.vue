<template>
  <F7Sheet
    class="people-sheet"
    :opened="opened"
    swipe-to-close
    backdrop
    close-by-backdrop-click
    @sheet:closed="emit('close')"
  >
    <div class="swipe-handler" />
    <F7PageContent class="people-sheet-content">
      <div class="px-6 pt-1 pb-2">
        <p class="m-0 text-[22px] leading-7 font-semibold">{{ t("preview.title") }}</p>
        <p class="mt-1 mb-0 text-sm text-muted-foreground">{{ t("preview.text") }}</p>
      </div>
      <RoleOptions
        :model-value="viewed"
        :roles="roles"
        name="preview-role"
        @update:model-value="choose"
      />
      <F7BlockFooter>{{ t("preview.footnote") }}</F7BlockFooter>
    </F7PageContent>
  </F7Sheet>
</template>

<script setup lang="ts">
import { APP_ROLE_ORDER, roleRank } from "@capuchoo/core";
import { setViewAs, viewedRole } from "@/shared/access/viewAs";
import RoleOptions from "@/shared/components/app/RoleOptions.vue";
import type { AppRole } from "@/shared/database/schema";

/** The roles at or below the account's own: a preview only ever narrows what is offered. */
const props = defineProps<{ opened: boolean; actual: AppRole }>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();

const roles = computed(() =>
  APP_ROLE_ORDER.filter((role) => roleRank(role) <= roleRank(props.actual)),
);
const viewed = computed(() => viewedRole(props.actual));

function choose(role: AppRole): void {
  setViewAs(role === props.actual ? null : role);
  emit("close");
}
</script>
