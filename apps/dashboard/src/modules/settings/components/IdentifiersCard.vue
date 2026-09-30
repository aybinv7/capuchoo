<script setup lang="ts">
import { isValidBundleId, type Environment } from "@capuchoo/core";
import { Trash2 } from "@lucide/vue";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { ENVIRONMENT_ORDER } from "@/shared/lib/channels";
import type { useAppGeneral } from "../composables/useAppGeneral";
import type { AppIdentifier } from "../types/settings.types";
import SettingsSection from "./SettingsSection.vue";

const props = defineProps<{
  primary: string;
  identifiers: readonly AppIdentifier[];
  editable: boolean;
  add: ReturnType<typeof useAppGeneral>["addIdentifier"];
  remove: ReturnType<typeof useAppGeneral>["removeIdentifier"];
}>();

const bundleId = ref("");
const platform = ref<AppIdentifier["platform"]>("all");
const flavour = ref<Environment | "">("");

const valid = computed(() => isValidBundleId(bundleId.value.trim()));

function submit() {
  if (!valid.value) return;
  props.add.mutate(
    { bundle_id: bundleId.value.trim(), platform: platform.value, flavour: flavour.value || null },
    {
      onSuccess: (row) => {
        toast.success(`${row.bundle_id} registered`);
        bundleId.value = "";
      },
    },
  );
}
</script>

<template>
  <SettingsSection
    title="Bundle identifiers"
    description="Each identifier maps a build to this app, and optionally to one flavour. No flavour means every flavour ships under it."
  >
    <ul class="divide-y rounded-lg border">
      <li
        v-for="identifier in props.identifiers"
        :key="identifier.id"
        class="flex items-center gap-3 px-4 py-2 text-sm"
      >
        <span class="flex-1 truncate font-mono">{{ identifier.bundle_id }}</span>
        <span class="text-muted-foreground font-mono text-xs uppercase">{{
          identifier.platform
        }}</span>
        <EnvBadge v-if="identifier.flavour" :environment="identifier.flavour" size="sm" />
        <span v-else class="text-muted-foreground text-xs">all flavours</span>
        <span v-if="identifier.bundle_id === props.primary" class="text-muted-foreground text-xs"
          >primary</span
        >
        <Button
          v-else-if="props.editable"
          variant="ghost"
          size="icon-sm"
          :aria-label="`Remove ${identifier.bundle_id}`"
          :disabled="props.remove.isPending.value"
          @click="props.remove.mutate(identifier.bundle_id)"
        >
          <Trash2 />
        </Button>
      </li>
    </ul>
    <form
      v-if="props.editable"
      class="mt-4 flex flex-wrap items-center gap-2"
      novalidate
      @submit.prevent="submit"
    >
      <Input
        v-model="bundleId"
        class="w-64 font-mono"
        placeholder="com.acme.field.staging"
        aria-label="Bundle identifier"
        spellcheck="false"
      />
      <NativeSelect v-model="platform" class="h-9 w-32" aria-label="Platform">
        <NativeSelectOption value="all">all</NativeSelectOption>
        <NativeSelectOption value="android">android</NativeSelectOption>
        <NativeSelectOption value="ios">ios</NativeSelectOption>
      </NativeSelect>
      <NativeSelect v-model="flavour" class="h-9 w-36" aria-label="Flavour">
        <NativeSelectOption value="">all flavours</NativeSelectOption>
        <NativeSelectOption v-for="env in ENVIRONMENT_ORDER" :key="env" :value="env">{{
          env
        }}</NativeSelectOption>
      </NativeSelect>
      <Button type="submit" variant="outline" :disabled="!valid || props.add.isPending.value"
        >Add</Button
      >
    </form>
    <ErrorNotice v-if="props.add.error.value" :error="props.add.error.value" class="mt-3" />
  </SettingsSection>
</template>
