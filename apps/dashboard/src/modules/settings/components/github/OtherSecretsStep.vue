<script setup lang="ts">
import type { GithubWorkflowSecret } from "@capuchoo/core";
import { CircleCheck, CircleDashed } from "@lucide/vue";
import { ref } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import type { GithubSetup } from "@/shared/types/ci";
import type { useGithubSecrets } from "../../composables/useGithubSecrets";

const props = defineProps<{
  secrets: GithubSetup["secrets"];
  store: ReturnType<typeof useGithubSecrets>["store"];
}>();

const HINTS: Partial<Record<GithubWorkflowSecret, string>> = {
  CAPUCHOO_SIGNING_KEY:
    "The private key that signs OTA bundles, when the app requires signed bundles. Paste the PEM.",
};

const editing = ref<GithubWorkflowSecret | null>(null);
const value = ref("");

function edit(name: GithubWorkflowSecret) {
  editing.value = name;
  value.value = "";
}

function save() {
  const name = editing.value;
  if (!name || !value.value.trim()) return;
  props.store.mutate([{ name, value: value.value.trim() }], {
    onSuccess: () => {
      toast.success(`${name} stored`);
      editing.value = null;
    },
    onSettled: () => {
      value.value = "";
    },
  });
}
</script>

<template>
  <ul class="divide-y rounded-md border text-sm">
    <li v-for="secret in props.secrets" :key="secret.name" class="space-y-2 px-3 py-2.5">
      <div class="flex items-center gap-2">
        <CircleCheck v-if="secret.present" class="text-success size-4" />
        <CircleDashed v-else class="text-muted-foreground size-4" />
        <code class="min-w-0 flex-1 truncate font-mono text-xs">{{ secret.name }}</code>
        <span class="text-muted-foreground text-xs">{{
          secret.required === "always"
            ? "required"
            : secret.required === "native"
              ? "native builds"
              : "optional"
        }}</span>
        <Button
          v-if="editing !== secret.name"
          variant="ghost"
          size="xs"
          @click="edit(secret.name)"
          >{{ secret.present ? "Replace" : "Set" }}</Button
        >
      </div>
      <p v-if="HINTS[secret.name]" class="text-muted-foreground text-xs">
        {{ HINTS[secret.name] }}
      </p>
      <form
        v-if="editing === secret.name"
        class="space-y-2"
        autocomplete="off"
        @submit.prevent="save"
      >
        <Textarea
          v-model="value"
          rows="4"
          class="font-mono text-xs"
          spellcheck="false"
          :aria-label="`Value of ${secret.name}`"
        />
        <ErrorNotice v-if="props.store.error.value" :error="props.store.error.value" />
        <div class="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="xs" @click="editing = null">Cancel</Button>
          <Button type="submit" size="xs" :disabled="!value.trim() || props.store.isPending.value">
            <Spinner v-if="props.store.isPending.value" />
            Seal and store
          </Button>
        </div>
      </form>
    </li>
  </ul>
</template>
