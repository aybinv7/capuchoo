<template>
  <div
    ref="root"
    class="pointer-events-none absolute inset-x-0 z-[400] flex h-40 justify-center overflow-hidden"
    :style="{ top: `${top}px` }"
  >
    <div
      v-show="fraction > 0 || refreshing"
      class="relative size-12"
      :style="{ transform: `translateY(${offset}px) rotate(${rotation}deg)` }"
    >
      <LoadingIndicator
        contained
        class="absolute! inset-0 transition-opacity duration-150"
        :class="refreshing ? 'opacity-0' : 'opacity-100'"
        :progress="fraction"
        :label="t('refresh.label')"
      />
      <Transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-150"
        leave-to-class="opacity-0"
      >
        <LoadingIndicator
          v-if="refreshing"
          contained
          class="absolute! inset-0"
          :label="t('refresh.label')"
        />
      </Transition>
    </div>
    <span class="sr-only" aria-live="polite">{{ refreshing ? t("refresh.label") : "" }}</span>
  </div>
</template>

<script setup lang="ts">
import type { Database } from "@/shared/database/schema";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import { usePullToRefresh } from "@/shared/composables/refresh/usePullToRefresh";
import { refreshTables } from "@/shared/database/refresh";
import { indicatorOffset, overpullRotation } from "@/shared/utils/motion/pullToRefresh";

/**
 * Material 3 Expressive pull-to-refresh for a Framework7 page. Put it in the page's `#fixed`
 * slot: it binds to the page's own scroller and draws the indicator from under the content's top
 * edge, below the navbar. The pull drives the determinate indicator; past the threshold on release
 * it crossfades to the morphing loop until the refresh settles.
 *
 * `action` runs first - the sync - and `tables` are then re-read through the change bus.
 */
const props = defineProps<{
  tables: readonly (keyof Database)[];
  action?: () => Promise<void>;
}>();

const { t } = useI18n();
const root = useTemplateRef<HTMLElement>("root");
const scroller = ref<HTMLElement | null>(null);
const top = ref(0);

async function run(): Promise<void> {
  if (props.action) await props.action();
  refreshTables(props.tables);
}

const { fraction, refreshing } = usePullToRefresh(scroller, run);

const offset = computed(() => indicatorOffset(fraction.value));
const rotation = computed(() => (refreshing.value ? 0 : overpullRotation(fraction.value)));

function measureTop(): void {
  const el = scroller.value;
  if (el) top.value = Number.parseFloat(getComputedStyle(el).paddingTop) || 0;
}

watch(fraction, (value, previous) => {
  if (previous === 0 && value > 0) measureTop();
});

onMounted(() => {
  scroller.value = root.value?.closest(".page")?.querySelector(":scope > .page-content") ?? null;
  measureTop();
});
</script>
