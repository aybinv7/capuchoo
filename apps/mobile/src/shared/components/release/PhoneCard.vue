<template>
  <section class="phone-card" :class="`phone-${status.state}`">
    <div class="flex items-start gap-4">
      <MaterialShape :shape="shape" class="grid size-16 shrink-0 place-items-center phone-shape">
        <F7Icon :md="`material:${icon}`" size="30" />
      </MaterialShape>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold tracking-wide uppercase opacity-80">
          {{ t("phone.title") }}
        </p>
        <p class="text-[22px] leading-7 font-semibold">{{ headline }}</p>
        <p class="mt-1 text-sm opacity-85">{{ detail }}</p>
      </div>
    </div>

    <div v-if="actionable || canOpen" class="mt-5 flex flex-col gap-2">
      <InstallControl
        v-if="actionable"
        :job="job"
        :label="actionLabel"
        :icon="status.state === 'behind' ? 'system_update' : 'download'"
        large
        @install="emit('install')"
        @cancel="emit('cancel')"
      />
      <F7Button v-if="canOpen" round class="phone-open font-semibold!" @click="emit('open')">
        <F7Icon md="material:open_in_new" size="20" class="me-2" />
        {{ t("phone.open") }}
      </F7Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import type { PhoneStatus } from "@/shared/release/phone-status";
import { versionLabel } from "@/shared/utils/format";
import type { MaterialShapeName } from "@/shared/utils/shapes/materialShapes";
import type { InstallJob } from "@/shared/composables/release/useInstaller";
import InstallControl from "./InstallControl.vue";

/**
 * The app screen's lead: what this phone runs against what its channel serves, and the one action
 * that closes the gap. A tester opens an app for exactly this, so it comes first.
 */
const props = defineProps<{ status: PhoneStatus; canInstall: boolean; job?: InstallJob }>();
const emit = defineEmits<{ install: []; cancel: []; open: [] }>();
const { t } = useI18n();

const target = computed(() =>
  versionLabel(props.status.target?.version_name, props.status.target?.version_code),
);
const installed = computed(() =>
  versionLabel(props.status.installedName, props.status.installedCode),
);
const channel = computed(() => props.status.channel?.name ?? "prod");

const shape = computed<MaterialShapeName>(
  () =>
    ({
      behind: "sunny",
      current: "cookie9",
      ahead: "flower",
      untracked: "pentagon",
      absent: "clover4",
    })[props.status.state] as MaterialShapeName,
);
const icon = computed(
  () =>
    ({
      behind: "system_update",
      current: "verified",
      ahead: "science",
      untracked: "help_outline",
      absent: "download",
    })[props.status.state],
);

const headline = computed(() =>
  t(`phone.${props.status.state}.headline`, {
    installed: installed.value,
    target: target.value,
    channel: channel.value,
  }),
);
const detail = computed(() =>
  t(`phone.${props.status.state}.detail`, {
    installed: installed.value,
    target: target.value,
    channel: channel.value,
  }),
);

const actionable = computed(
  () =>
    props.canInstall &&
    Boolean(props.status.target) &&
    ["behind", "absent"].includes(props.status.state),
);
const actionLabel = computed(() =>
  props.status.state === "behind"
    ? t("phone.update", { version: target.value })
    : t("phone.install", { version: target.value }),
);
const canOpen = computed(() => props.status.state !== "absent" && Boolean(props.status.bundleId));
</script>

<style scoped>
/* The phone's state sets the card's tone: the one tonal surface on the screen, so it leads. */
.phone-card {
  padding: 20px;
  border-radius: var(--radius-xl-increased);
  background: var(--phone-bg, var(--secondary));
  color: var(--phone-fg, var(--secondary-foreground));
  animation: phone-in var(--duration-long) var(--ease-emphasized-decelerate) both;
}

.phone-shape {
  background: var(--phone-shape, var(--card));
  color: var(--phone-fg, var(--secondary-foreground));
  animation: shape-in 600ms var(--ease-spring-fast) 80ms both;
}

.phone-behind {
  --phone-bg: var(--primary-container);
  --phone-fg: var(--primary-container-foreground);
  --phone-shape: color-mix(in srgb, var(--card) 70%, transparent);
}

.phone-current {
  --phone-bg: var(--env-prod-container);
  --phone-fg: var(--env-prod-foreground);
  --phone-shape: color-mix(in srgb, var(--card) 70%, transparent);
}

.phone-ahead {
  --phone-bg: var(--tertiary);
  --phone-fg: var(--tertiary-foreground);
  --phone-shape: color-mix(in srgb, var(--card) 70%, transparent);
}

/* The card's own tone, one step stronger, so its second action reads as part of it. */
.phone-open {
  background: color-mix(in srgb, var(--phone-fg, var(--secondary-foreground)) 12%, transparent);
  color: var(--phone-fg, var(--secondary-foreground));
}

@keyframes phone-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}

@keyframes shape-in {
  from {
    transform: scale(0.4) rotate(-60deg);
  }
}
</style>
