<template>
  <span class="inline-flex items-center gap-1" :class="look.tone">
    <F7Icon :md="`material:${look.icon}`" size="16" />
    {{ look.label }}
  </span>
</template>

<script setup lang="ts">
import type { PhoneStatus } from "@/shared/release/phone-status";
import { versionLabel } from "@/shared/utils/format";

/** Where this phone stands for an app, in words and one icon - the reason the list is opened. */
const props = defineProps<{ status: PhoneStatus }>();
const { t } = useI18n();

const look = computed(() => {
  const { state, installedName, installedCode, target } = props.status;
  const installed = versionLabel(installedName, installedCode);
  switch (state) {
    case "behind":
      return {
        icon: "system_update",
        tone: "text-primary font-semibold",
        label: t("phone.behindShort", {
          version: versionLabel(target?.version_name, target?.version_code),
        }),
      };
    case "current":
      return {
        icon: "check_circle",
        tone: "text-env-prod",
        label: t("phone.currentShort", { version: installed }),
      };
    case "ahead":
      return {
        icon: "science",
        tone: "text-tertiary-foreground",
        label: t("phone.aheadShort", { version: installed }),
      };
    case "untracked":
      return {
        icon: "phone_android",
        tone: "text-muted-foreground",
        label: t("phone.untrackedShort", { version: installed }),
      };
    default:
      return { icon: "download", tone: "text-muted-foreground", label: t("phone.absentShort") };
  }
});
</script>
