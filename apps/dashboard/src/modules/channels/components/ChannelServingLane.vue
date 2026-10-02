<script setup lang="ts">
import { ChevronRight, Package, Smartphone } from "@lucide/vue";
import { computed } from "vue";
import type { Gate } from "@/shared/lib/gate";
import { RouteName } from "@/shared/router/route-names";
import type { Bundle, NativeBuild } from "@/shared/types/release";
import { bundleStatus, nativeStatus } from "../lib/serving-lane";
import ServingNode from "./ServingNode.vue";

const props = defineProps<{
  bundle: Bundle | null;
  native: NativeBuild | null;
  /** The channel points at an artefact the catalog has not returned yet. */
  bundlePending: boolean;
  nativePending: boolean;
  deliverGate: Gate;
}>();
const emit = defineEmits<{ deliver: [kind: "ota" | "native"] }>();

const nativeTo = computed(() => ({
  name: RouteName.releases,
  query: props.native ? { kind: "native", q: props.native.version_name } : { kind: "native" },
}));
const bundleTo = computed(() => ({
  name: RouteName.releases,
  query: props.bundle ? { q: props.bundle.version_name } : {},
}));
</script>

<template>
  <section aria-label="Now serving" class="bg-card rounded-lg border p-1">
    <ol class="flex min-w-0 flex-col lg:flex-row lg:items-center">
      <li class="min-w-0 lg:flex-1">
        <ServingNode
          label="Native build"
          :artefact="props.native"
          :status="nativeStatus(props.native)"
          :to="nativeTo"
          :pending="props.nativePending"
          :deliver-gate="props.deliverGate"
          @deliver="emit('deliver', 'native')"
        >
          <template #icon><Smartphone /></template>
        </ServingNode>
      </li>
      <li
        class="text-muted-foreground/60 flex justify-center py-0.5 lg:px-0.5 lg:py-0"
        aria-hidden="true"
      >
        <ChevronRight class="size-4 rotate-90 lg:rotate-0" />
      </li>
      <li class="min-w-0 lg:flex-1">
        <ServingNode
          label="OTA bundle"
          :artefact="props.bundle"
          :status="bundleStatus(props.bundle, props.native)"
          :to="bundleTo"
          :pending="props.bundlePending"
          :deliver-gate="props.deliverGate"
          @deliver="emit('deliver', 'ota')"
        >
          <template #icon><Package /></template>
        </ServingNode>
      </li>
    </ol>
  </section>
</template>
