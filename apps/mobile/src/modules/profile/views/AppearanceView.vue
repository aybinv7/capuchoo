<template>
  <F7Page class="cap-page cap-pushed">
    <F7Navbar class="navbar-gradient" :title="t('appearance.title')" back-link :sliding="true" />

    <F7BlockTitle>{{ t("appearance.mode") }}</F7BlockTitle>
    <F7List strong inset dividers class="rounded-2xl!">
      <F7ListItem
        v-for="mode in MODES"
        :key="mode.id"
        radio
        radio-icon="end"
        name="color-mode"
        :value="mode.id"
        :checked="theme.mode === mode.id"
        :title="t(`appearance.modes.${mode.id}`)"
        @change="onMode(mode.id)"
      >
        <template #media
          ><F7Icon :md="`material:${mode.icon}`" class="text-muted-foreground"
        /></template>
      </F7ListItem>
    </F7List>
    <F7BlockFooter>{{ t("appearance.modeHint") }}</F7BlockFooter>

    <F7BlockTitle>{{ t("appearance.colors") }}</F7BlockTitle>
    <F7List strong inset media-list class="rounded-2xl!">
      <F7ListItem
        link="/profile/appearance/colors/"
        :title="t(`colors.schemes.${variant}.name`)"
        :subtitle="presetName"
      >
        <template #media>
          <span class="grid size-12 place-items-center rounded-2xl bg-primary-container">
            <span class="size-6 rounded-full bg-primary" />
          </span>
        </template>
      </F7ListItem>
    </F7List>
  </F7Page>
</template>

<script setup lang="ts">
import { useAppTheme, type ColorMode } from "@/shared/composables/theme/useAppTheme";
import { useColorTheme } from "@/shared/composables/theme/useColorTheme";

const MODES: Array<{ id: ColorMode; icon: string }> = [
  { id: "system", icon: "brightness_auto" },
  { id: "light", icon: "light_mode" },
  { id: "dark", icon: "dark_mode" },
];

useHiddenTabbar();
const { t } = useI18n();
const appTheme = useAppTheme();
const theme = computed(() => appTheme.value);
const { primary, variant, presets } = useColorTheme();

const presetName = computed(() => {
  const preset = presets.find((option) => option.hex === primary.value);
  return preset ? t(`colors.presets.${preset.id}`) : primary.value;
});

function onMode(mode: ColorMode): void {
  theme.value.setMode(mode);
}
</script>
