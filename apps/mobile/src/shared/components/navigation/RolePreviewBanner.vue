<template>
  <Transition name="cap-fade">
    <div
      v-if="app && previewing"
      class="role-preview"
      :class="{ 'above-bar': tabbarShown }"
      role="status"
    >
      <F7Icon md="material:visibility" size="18" />
      <span class="min-w-0 truncate">{{
        t("preview.banner", { role: t(`roles.name.${viewed}`) })
      }}</span>
      <button type="button" class="role-preview-exit" @click="exit">
        {{ t("preview.exit") }}
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { isPreviewing, setViewAs, viewedRole } from "@/shared/access/viewAs";
import { useCurrentApp } from "@/shared/composables/apps/useCurrentApp";
import { tick } from "@/shared/utils/native/haptics";

/**
 * While a role preview is on, every screen says so and offers the way out, so nobody mistakes a
 * tester's view for missing data.
 */
const { t } = useI18n();
const { app } = useCurrentApp();
const { isVisible: tabbarShown } = useTabbarVisibility();

const previewing = computed(() => (app.value ? isPreviewing(app.value.role) : false));
const viewed = computed(() => (app.value ? viewedRole(app.value.role) : "viewer"));

function exit(): void {
  tick();
  setViewAs(null);
}
</script>

<style scoped>
.role-preview {
  position: fixed;
  z-index: 600;
  inset-inline: 0;
  bottom: calc(var(--f7-safe-area-bottom) + var(--f7-toolbar-height, 56px) + 12px);
  width: fit-content;
  max-width: calc(100% - 32px);
  margin-inline: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 6px 14px;
  border-radius: 999px;
  background: var(--inverse);
  color: var(--inverse-foreground);
  font-size: 14px;
  font-weight: 500;
  box-shadow: var(--elevation-float);
}

.role-preview.above-bar {
  bottom: calc(var(--f7-safe-area-bottom) + var(--f7-tabbar-icons-height) + 12px);
}

.role-preview-exit {
  width: auto;
  height: 32px;
  padding-inline: 14px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--inverse-foreground) 16%, transparent);
  color: var(--inverse-foreground);
  font-weight: 600;
}
</style>
