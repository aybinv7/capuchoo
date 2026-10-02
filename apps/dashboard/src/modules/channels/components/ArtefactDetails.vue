<script setup lang="ts">
import { ShieldAlert, ShieldCheck } from "@lucide/vue";
import CopyButton from "@/shared/components/CopyButton.vue";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { formatBytes, shortId } from "@/shared/lib/format";
import type { Artefact } from "@/shared/types/release";

const props = defineProps<{ artefact: Artefact }>();
</script>

<template>
  <div class="space-y-3 text-xs">
    <div class="flex items-center justify-between gap-2">
      <span class="text-muted-foreground font-medium tracking-wide uppercase">
        {{ props.artefact.kind === "ota" ? "OTA bundle" : "Native build" }}
      </span>
      <EnvBadge :environment="props.artefact.flavour" size="sm" />
    </div>
    <dl class="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5">
      <dt class="text-muted-foreground">Platform</dt>
      <dd class="font-mono uppercase">{{ props.artefact.platform }}</dd>
      <dt class="text-muted-foreground">Size</dt>
      <dd class="font-mono tabular">{{ formatBytes(props.artefact.size_bytes) }}</dd>
      <dt class="text-muted-foreground">Signature</dt>
      <dd class="flex min-w-0 items-center gap-1">
        <template v-if="props.artefact.signed">
          <ShieldCheck class="text-success size-3.5 shrink-0" />
          signed
          <span
            v-if="props.artefact.kind === 'native' && props.artefact.signing_cert_sha256"
            class="text-muted-foreground truncate font-mono"
            :title="props.artefact.signing_cert_sha256"
            >· {{ shortId(props.artefact.signing_cert_sha256, 10) }}</span
          >
        </template>
        <template v-else>
          <ShieldAlert class="text-warning size-3.5 shrink-0" />
          unsigned
        </template>
      </dd>
      <dt class="text-muted-foreground">SHA-256</dt>
      <dd class="flex min-w-0 items-center gap-1">
        <span class="truncate font-mono" :title="props.artefact.checksum">{{
          shortId(props.artefact.checksum, 16)
        }}</span>
        <CopyButton
          v-if="props.artefact.checksum"
          :value="props.artefact.checksum"
          label="SHA-256"
          class="-my-1"
        />
      </dd>
      <dt class="text-muted-foreground">Uploaded</dt>
      <dd class="min-w-0">
        <RelativeTime :value="props.artefact.created_at" />
        <span v-if="props.artefact.uploaded_by" class="text-muted-foreground block truncate">
          by {{ props.artefact.uploaded_by }}</span
        >
      </dd>
    </dl>
    <p
      v-if="props.artefact.release_notes"
      class="bg-surface line-clamp-6 rounded-md border px-2.5 py-2 whitespace-pre-line text-pretty"
    >
      {{ props.artefact.release_notes }}
    </p>
  </div>
</template>
