<script setup lang="ts">
import { KeyRound } from "@lucide/vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import type { useGithubSecrets } from "../../composables/useGithubSecrets";

const props = defineProps<{
  present: boolean;
  apiKey: ReturnType<typeof useGithubSecrets>["apiKey"];
}>();

function mint() {
  props.apiKey.mutate(undefined, {
    onSuccess: (key) =>
      toast.success("API key stored in the repository", {
        description: `${key.name} (${key.key_prefix}…) is listed under API keys; revoke it there to cut CI off.`,
      }),
  });
}
</script>

<template>
  <div class="space-y-3 text-sm">
    <p class="text-muted-foreground text-pretty">
      The workflow authenticates with a developer key limited to this app, saved as the
      <code class="text-foreground font-mono text-xs">CAPUCHOO_API_KEY</code> secret. The key goes
      straight from this browser into GitHub, sealed with the repository's key; it is never shown.
    </p>
    <Button
      size="sm"
      :variant="props.present ? 'outline' : 'default'"
      :disabled="props.apiKey.isPending.value"
      @click="mint"
    >
      <Spinner v-if="props.apiKey.isPending.value" />
      <KeyRound v-else />
      {{ props.present ? "Replace with a new key" : "Create key and store it" }}
    </Button>
    <ErrorNotice v-if="props.apiKey.error.value" :error="props.apiKey.error.value" />
    <p v-if="props.apiKey.error.value" class="text-muted-foreground text-xs">
      Nothing was left half done: a key that could not be stored was revoked.
    </p>
  </div>
</template>
