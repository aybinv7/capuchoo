<template>
  <F7Page class="cap-page cap-pushed">
    <F7Navbar class="navbar-gradient" :title="t('colors.title')" back-link :sliding="true">
      <F7NavRight>
        <F7Link :class="{ disabled: isDefault }" @click="reset">{{ t("colors.reset") }}</F7Link>
      </F7NavRight>
    </F7Navbar>

    <ThemePreview />
    <p class="m-0 px-8 pt-3 text-center text-sm text-muted-foreground">
      {{ t(`colors.schemes.${variant}.hint`) }}
    </p>

    <F7BlockTitle>{{ t("colors.seed") }}</F7BlockTitle>
    <F7Block strong inset class="rounded-2xl!">
      <div class="grid grid-cols-4 gap-2">
        <SeedSwatch
          v-for="(preset, index) in presets"
          :key="preset.id"
          :colors="bySeed[index]!"
          :label="t(`colors.presets.${preset.id}`)"
          :selected="preset.hex === primary"
          @pick="pick(preset.hex)"
        />
      </div>
    </F7Block>

    <F7List strong inset dividers class="rounded-2xl!">
      <F7ListInput
        type="colorpicker"
        readonly
        :label="t('colors.custom')"
        :placeholder="BRAND_PRIMARY"
        :value="{ hex: primary }"
        :color-picker-params="pickerParams"
        @colorpicker:change="onCustomColor"
      >
        <template #media>
          <span
            id="color-theme-swatch"
            class="block! size-7 rounded-full ring-1 ring-border"
            :style="{ background: primary }"
          />
        </template>
      </F7ListInput>
    </F7List>
    <F7BlockFooter>{{
      isPreset ? t("colors.customHint") : t("colors.customActive", { hex: primary })
    }}</F7BlockFooter>

    <F7BlockTitle>{{ t("colors.style") }}</F7BlockTitle>
    <div class="variant-row swiper-no-swiping" role="radiogroup" :aria-label="t('colors.style')">
      <VariantTile
        v-for="(option, index) in variants"
        :key="option"
        :colors="byVariant[index]!"
        :label="t(`colors.schemes.${option}.name`)"
        :selected="option === variant"
        @pick="pickVariant(option)"
      />
    </div>

    <F7BlockTitle>{{ t("colors.roles") }}</F7BlockTitle>
    <F7Block strong inset class="rounded-2xl!">
      <div class="grid grid-cols-3 gap-2">
        <span
          v-for="role in ROLES"
          :key="role"
          class="flex h-14 items-end rounded-xl p-2 text-[10px] leading-tight font-semibold"
          :style="{ background: `var(--m3-${role})`, color: `var(--m3-${onRole(role)})` }"
        >
          {{ role }}
        </span>
      </div>
    </F7Block>
    <F7BlockFooter>{{ t("colors.rolesHint") }}</F7BlockFooter>
  </F7Page>
</template>

<script setup lang="ts">
import type { SchemeVariant } from "@/shared/composables/theme/materialScheme";
import { useAppTheme } from "@/shared/composables/theme/useAppTheme";
import { useColorTheme } from "@/shared/composables/theme/useColorTheme";
import { BRAND_PRIMARY } from "@/shared/utils/theme/brand";
import { tick } from "@/shared/utils/native/haptics";
import SeedSwatch from "../components/SeedSwatch.vue";
import ThemePreview from "../components/ThemePreview.vue";
import VariantTile from "../components/VariantTile.vue";
import { useSchemePreviews } from "../composables/useSchemePreviews";

const ROLES = [
  "primary",
  "primary-container",
  "secondary-container",
  "tertiary-container",
  "surface-container-lowest",
  "surface-container-highest",
] as const;

useHiddenTabbar();
const { t } = useI18n();
const theme = useAppTheme();
const { primary, variant, variants, presets, isDefault, reset } = useColorTheme();
const dark = computed(() => theme.value.dark);
const { bySeed, byVariant } = useSchemePreviews(
  presets.map((preset) => preset.hex),
  variants,
  primary,
  variant,
  dark,
);

const isPreset = computed(() => presets.some((preset) => preset.hex === primary.value));

/** The picker opens as a sheet with the hue wheel, which is the one a thumb can drive. */
const pickerParams = {
  targetEl: "#color-theme-swatch",
  openIn: "sheet",
  modules: ["wheel", "hex"],
  sheetCloseLinkText: t("common.done"),
};

function onRole(role: (typeof ROLES)[number]): string {
  return role.startsWith("surface") ? "on-surface" : `on-${role}`;
}

function pick(hex: string): void {
  if (hex === primary.value) return;
  tick();
  primary.value = hex;
}

function pickVariant(option: SchemeVariant): void {
  if (option === variant.value) return;
  tick();
  variant.value = option;
}

function onCustomColor(value: { hex?: string }): void {
  if (value.hex) primary.value = value.hex;
}
</script>

<style scoped>
/* The styles scroll sideways inside the page's own inset, snapping a tile to the start edge. */
.variant-row {
  display: flex;
  gap: 12px;
  margin: 0;
  padding: 4px 16px 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: 16px;
  scrollbar-width: none;
}
</style>
