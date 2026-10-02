<script setup lang="ts">
import { ShieldAlert, Tags } from "@lucide/vue";
import { computed } from "vue";
import CopyButton from "@/shared/components/CopyButton.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { attributeEntries } from "../lib/device-attributes";
import type { DeviceAttributes } from "../types/devices.types";

const props = defineProps<{
  attributes: DeviceAttributes | null;
  updatedAt: string | null;
}>();

const entries = computed(() => attributeEntries(props.attributes));

const SNIPPET = `import { setDeviceAttributes } from "@capuchoo/updater";

await setDeviceAttributes({ employeeId: "E-1042", route: "Oran West" });`;
</script>

<template>
  <section class="bg-card flex min-w-0 flex-col rounded-lg border">
    <header class="flex items-center justify-between gap-2 border-b px-4 py-2.5">
      <span class="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase">
        <Tags class="size-3.5" />
        Attributes
        <span v-if="entries.length" class="font-mono normal-case tabular">{{
          entries.length
        }}</span>
      </span>
      <span v-if="props.updatedAt" class="text-muted-foreground text-xs">
        set <RelativeTime :value="props.updatedAt" />
      </span>
    </header>

    <dl v-if="entries.length" class="grid flex-1 content-start gap-px sm:grid-cols-2">
      <div
        v-for="entry in entries"
        :key="entry.key"
        class="group/attr hover:bg-surface flex min-w-0 items-start gap-2 px-4 py-2"
      >
        <div class="min-w-0 flex-1">
          <dt class="text-muted-foreground truncate font-mono text-[11px]">{{ entry.key }}</dt>
          <dd class="text-sm font-medium break-words">{{ entry.value }}</dd>
        </div>
        <CopyButton
          :value="entry.value"
          :label="entry.key"
          class="pointer-fine:group-hover/attr:opacity-100 pointer-fine:opacity-0 mt-1 focus-visible:opacity-100"
        />
      </div>
    </dl>

    <div v-else class="flex-1 space-y-3 px-4 py-4">
      <p class="text-sm text-pretty">
        <span class="font-medium">No attributes yet.</span>
        <span class="text-muted-foreground">
          Set them from the app so testers can tell whose device this is without looking it up
          elsewhere.</span
        >
      </p>
      <div class="bg-surface relative rounded-md border">
        <pre
          class="overflow-x-auto px-3 py-2.5 pr-10 font-mono text-[11px] leading-relaxed"
        ><code>{{ SNIPPET }}</code></pre>
        <CopyButton :value="SNIPPET" label="snippet" class="absolute top-1.5 right-1.5" />
      </div>
    </div>

    <footer
      class="text-muted-foreground flex items-start gap-1.5 border-t px-4 py-2 text-[11px] text-pretty"
    >
      <ShieldAlert class="mt-px size-3 shrink-0" />
      Often personal data (Law 18-07): prefer an opaque id over a name or phone number, and clear
      them on sign-out.
    </footer>
  </section>
</template>
