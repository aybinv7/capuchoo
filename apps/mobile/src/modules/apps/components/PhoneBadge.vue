<template>
  <span class="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold" :class="look.classes">
    <F7Icon :md="`material:${look.icon}`" size="16" />
    {{ look.label }}
  </span>
</template>

<script setup lang="ts">
import type { PhoneStatus } from "@/shared/release/phone-status";
import { versionLabel } from "@/shared/utils/format";

/** Where this phone stands for an app, in one pill: the reason someone opens the app list. */
const props = defineProps<{ status: PhoneStatus }>();
const { t } = useI18n();

const look = computed(() => {
  const { state, installedName, installedCode, target } = props.status;
  switch (state) {
    case "behind":
      return {
        icon: "system_update",
        classes: "bg-primary text-primary-foreground",
        label: t("phone.behindShort", { version: versionLabel(target?.version_name, target?.version_code) }),
      };
    case "current":
      return {
        icon: "check_circle",
        classes: "bg-env-prod-container text-env-prod-foreground",
        label: t("phone.currentShort", { version: versionLabel(installedName, installedCode) }),
      };
    case "ahead":
      return {
        icon: "science",
        classes: "bg-tertiary text-tertiary-foreground",
        label: t("phone.aheadShort", { version: versionLabel(installedName, installedCode) }),
      };
    case "untracked":
      return {
        icon: "phone_android",
        classes: "bg-secondary text-secondary-foreground",
        label: t("phone.untrackedShort", { version: versionLabel(installedName, installedCode) }),
      };
    default:
      return { icon: "download", classes: "bg-muted text-muted-foreground", label: t("phone.absentShort") };
  }
});
</script>
