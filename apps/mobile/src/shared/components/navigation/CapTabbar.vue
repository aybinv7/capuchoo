<template>
  <F7Toolbar tabbar icons bottom class="cap-tabbar" :class="{ 'tabbar-hidden': !isVisible }">
    <F7Link
      v-for="tab in tabs"
      :key="tab.id"
      icon-only
      :tab-link="`#view-${tab.id}`"
      :tab-link-active="isActive(tab)"
      ripple-color="transparent"
      :aria-label="t(tab.labelKey)"
      @click="tick"
    >
      <span class="cap-tab-item">
        <span class="relative">
          <F7Icon :md="`material:${tab.iconMd}`" :class="iconFontClass(tab)" />
          <span v-if="badges[tab.id]" class="cap-tab-badge" aria-hidden="true">{{
            badges[tab.id]
          }}</span>
        </span>
        <span class="tabbar-label">{{ t(tab.labelKey) }}</span>
      </span>
    </F7Link>
  </F7Toolbar>
</template>

<script setup lang="ts">
import { tabs, type TabDefinition } from "@/app/tabs";
import { tick } from "@/shared/utils/native/haptics";

/** Counts shown on a destination, by tab id; anything falsy shows nothing. */
defineProps<{ badges: Partial<Record<TabDefinition["id"], string | number>> }>();

const { t } = useI18n();
const { isVisible } = useTabbarVisibility();

/**
 * Framework7 marks a tab link active only when a tab is shown, never for the tab the app starts
 * on, and its active pill hangs off that class - so the start tab had no pill until the first
 * switch. The shell's record is the source instead.
 */
function isActive(tab: TabDefinition): boolean {
  return activeTabId.value === `view-${tab.id}`;
}

/**
 * Material draws the selected/unselected pair with two fonts rather than two ligature names, both
 * bundled in `assets/css/icons.css`, so the active tab reads as active when colour alone is not
 * enough.
 */
function iconFontClass(tab: TabDefinition): string {
  return isActive(tab) ? "" : "material-icons-outlined";
}
</script>

<style>
.cap-tabbar.toolbar::before,
.cap-tabbar.toolbar::after {
  display: none !important;
}

/* M3's navigation bar is a surface container, one tone from the page - never the page itself. */
.md .cap-shell .cap-tabbar.toolbar {
  background-color: var(--bar);
}

.md .cap-tabbar .tab-link {
  padding-top: 6px;
  padding-bottom: 6px;
  overflow: visible;
}

.cap-tabbar .toolbar-inner {
  overflow: visible;
}

.cap-tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cap-tabbar .tabbar-label {
  line-height: 16px;
  letter-spacing: 0.5px;
}

.md .cap-tabbar i.icon::before {
  width: 56px;
}

.md .cap-tabbar i.icon + .tabbar-label,
.md .cap-tabbar .relative + .tabbar-label {
  margin-top: 4px;
}

/* M3's large badge: 16dp tall, error-coloured, on the icon's top-end corner. */
.cap-tab-badge {
  position: absolute;
  top: -2px;
  inset-inline-start: calc(50% + 4px);
  z-index: 1;
  min-width: 16px;
  height: 16px;
  padding-inline: 4px;
  border-radius: 999px;
  background: var(--destructive);
  color: var(--destructive-foreground);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.toolbar.tabbar.tabbar-hidden {
  transform: translateY(100%) !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
</style>
