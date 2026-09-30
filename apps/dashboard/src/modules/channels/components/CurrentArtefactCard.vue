<script setup lang="ts">
import { BadgeCheck, Package, ShieldAlert, Smartphone } from "@lucide/vue";
import { computed } from "vue";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { formatBytes, shortId } from "@/shared/lib/format";
import type { Artefact } from "@/shared/types/release";

const props = defineProps<{ kind: "ota" | "native"; artefact: Artefact | null }>();

const title = computed(() => (props.kind === "ota" ? "OTA bundle" : "Native build"));
const gate = computed(() => {
  const artefact = props.artefact;
  if (!artefact) return null;
  if (artefact.kind === "ota")
    return artefact.min_native_version !== null
      ? `needs native ≥ ${artefact.min_native_version}`
      : "any native build";
  return artefact.min_sdk !== null ? `min SDK ${artefact.min_sdk}` : null;
});
</script>

<template>
  <section class="bg-card rounded-lg border">
    <header
      class="text-muted-foreground flex items-center gap-2 border-b px-4 py-2.5 text-xs font-medium uppercase"
    >
      <Package v-if="props.kind === 'ota'" class="size-3.5" />
      <Smartphone v-else class="size-3.5" />
      {{ title }}
    </header>
    <div v-if="!props.artefact" class="text-muted-foreground px-4 py-6 text-sm">
      Nothing served yet.
    </div>
    <div v-else class="space-y-3 px-4 py-4">
      <div class="flex flex-wrap items-baseline gap-2">
        <span class="font-mono text-2xl font-semibold tracking-tight tabular">{{
          props.artefact.version_name
        }}</span>
        <span
          v-if="props.artefact.kind === 'native'"
          class="text-muted-foreground font-mono text-sm"
          >build {{ props.artefact.version_code }}</span
        >
        <EnvBadge :environment="props.artefact.flavour" size="sm" />
        <span
          v-if="props.artefact.required"
          class="bg-warning-soft text-warning rounded px-1.5 text-[10px] font-semibold uppercase"
          >required</span
        >
      </div>
      <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        <div>
          <dt class="text-muted-foreground">Platform</dt>
          <dd class="font-mono uppercase">{{ props.artefact.platform }}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">Size</dt>
          <dd class="font-mono tabular">{{ formatBytes(props.artefact.size_bytes) }}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">Signature</dt>
          <dd class="flex items-center gap-1">
            <template v-if="props.artefact.signed">
              <BadgeCheck class="text-success size-3.5" />
              signed
            </template>
            <template v-else>
              <ShieldAlert class="text-muted-foreground size-3.5" />
              unsigned
            </template>
          </dd>
        </div>
        <div v-if="gate">
          <dt class="text-muted-foreground">Gate</dt>
          <dd>{{ gate }}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">Uploaded</dt>
          <dd>
            <RelativeTime :value="props.artefact.created_at" />
            <span v-if="props.artefact.uploaded_by" class="text-muted-foreground">
              by {{ props.artefact.uploaded_by }}</span
            >
          </dd>
        </div>
        <div>
          <dt class="text-muted-foreground">SHA-256</dt>
          <dd class="font-mono" :title="props.artefact.checksum">
            {{ shortId(props.artefact.checksum, 12) }}
          </dd>
        </div>
      </dl>
      <p
        v-if="props.artefact.release_notes"
        class="text-muted-foreground border-t pt-3 text-sm whitespace-pre-line"
      >
        {{ props.artefact.release_notes }}
      </p>
    </div>
  </section>
</template>
