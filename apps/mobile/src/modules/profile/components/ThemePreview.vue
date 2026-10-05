<template>
  <div class="theme-preview" aria-hidden="true">
    <div class="preview-screen">
      <div class="flex items-center justify-between px-3 pt-3">
        <span class="text-[15px] font-bold tracking-tight text-foreground">{{
          t("tabs.home")
        }}</span>
        <span class="preview-live" />
      </div>

      <div class="preview-card mx-2.5 mt-2.5">
        <span class="preview-icon bg-tone-1 text-tone-1-foreground">
          <F7Icon md="material:rocket_launch" size="16" />
        </span>
        <span class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="h-2 w-16 rounded-full bg-foreground/80" />
          <span class="h-1.5 w-24 rounded-full bg-muted-foreground/50" />
        </span>
        <span class="preview-pill bg-primary text-primary-foreground">1.5.0</span>
      </div>

      <div class="preview-card mx-2.5 mt-1.5">
        <span class="preview-icon bg-tone-2 text-tone-2-foreground">
          <F7Icon md="material:storefront" size="16" />
        </span>
        <span class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="h-2 w-12 rounded-full bg-foreground/80" />
          <span class="flex gap-1">
            <span class="size-1.5 rounded-full bg-env-dev" />
            <span class="size-1.5 rounded-full bg-env-staging" />
            <span class="size-1.5 rounded-full bg-env-prod" />
          </span>
        </span>
        <span class="preview-pill bg-secondary text-secondary-foreground">{{
          t("colors.sample.chip")
        }}</span>
      </div>

      <div class="preview-bar">
        <span class="preview-tab active"><F7Icon md="material:apps" size="16" /></span>
        <span class="preview-tab"
          ><F7Icon md="material:notifications" size="16" class="material-icons-outlined"
        /></span>
        <span class="preview-tab"
          ><F7Icon md="material:person" size="16" class="material-icons-outlined"
        /></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The app in miniature, painted with the live tokens rather than a computed copy - so it is the
 * real result of the choice, including dark mode, and it can never drift from what screens show.
 */
const { t } = useI18n();
</script>

<style scoped>
.theme-preview {
  display: grid;
  place-items: center;
  padding: 20px 0 4px;
}

.preview-screen {
  position: relative;
  width: 196px;
  height: 212px;
  overflow: hidden;
  border-radius: 28px;
  background: var(--background);
  box-shadow:
    inset 0 0 0 1px var(--border),
    var(--elevation-raised);
  transition: background-color var(--duration-medium) linear;
}

.preview-live {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--env-prod);
}

.preview-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 14px;
  background: var(--card);
}

.preview-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 10px;
}

.preview-pill {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
}

.preview-bar {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  display: flex;
  justify-content: space-around;
  padding: 8px 6px 10px;
  background: var(--bar);
}

.preview-tab {
  display: grid;
  place-items: center;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  color: var(--muted-foreground);
}

.preview-tab.active {
  background: var(--m3-secondary-container);
  color: var(--m3-on-secondary-container);
}
</style>
