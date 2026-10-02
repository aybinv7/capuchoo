<script setup lang="ts">
import { ShieldCheck } from "@lucide/vue";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { fileToBase64 } from "@/shared/lib/base64";
import { formatBytes } from "@/shared/lib/format";
import type { useGithubSecrets } from "../../composables/useGithubSecrets";

const props = defineProps<{
  configured: number;
  store: ReturnType<typeof useGithubSecrets>["store"];
}>();

const MAX_KEYSTORE_BYTES = 36 * 1024;

const open = ref(props.configured > 0 && props.configured < 4);
const fileKey = ref(0);
const file = ref<File | null>(null);
const alias = ref("");
const storePassword = ref("");
const keyPassword = ref("");
const samePassword = ref(true);
const problem = ref<string | null>(null);

const ready = computed(
  () =>
    Boolean(file.value) &&
    alias.value.trim().length > 0 &&
    storePassword.value.length > 0 &&
    (samePassword.value || keyPassword.value.length > 0),
);

function pick(event: Event) {
  problem.value = null;
  const chosen = (event.target as HTMLInputElement).files?.[0] ?? null;
  if (chosen && chosen.size > MAX_KEYSTORE_BYTES) {
    problem.value = `GitHub secrets hold up to 48 KB once encoded; this keystore is ${formatBytes(chosen.size)}.`;
    file.value = null;
    return;
  }
  file.value = chosen;
}

function clear() {
  file.value = null;
  alias.value = "";
  storePassword.value = "";
  keyPassword.value = "";
  fileKey.value += 1;
}

async function upload() {
  if (!ready.value || !file.value) return;
  problem.value = null;
  let keystore: string;
  try {
    keystore = await fileToBase64(file.value);
  } catch {
    problem.value = "The keystore file could not be read.";
    return;
  }
  const storeValue = storePassword.value;
  props.store.mutate(
    [
      { name: "ANDROID_KEYSTORE_BASE64", value: keystore },
      { name: "ANDROID_KEYSTORE_PASSWORD", value: storeValue },
      { name: "ANDROID_KEY_ALIAS", value: alias.value.trim() },
      { name: "ANDROID_KEY_PASSWORD", value: samePassword.value ? storeValue : keyPassword.value },
    ],
    {
      onSuccess: () => {
        open.value = false;
        toast.success("Android signing secrets stored");
      },
      onSettled: clear,
    },
  );
}
</script>

<template>
  <div class="space-y-3 text-sm">
    <p class="text-muted-foreground text-pretty">
      Release APKs are signed on the runner with your upload keystore. The file and its passwords
      are sealed here and go straight to GitHub; Capuchoo never receives them.
      <template v-if="props.configured > 0 && props.configured < 4">
        <span class="text-warning">{{ props.configured }} of 4 secrets are set.</span>
      </template>
    </p>

    <Button v-if="!open" size="sm" variant="outline" @click="open = true">
      <ShieldCheck />
      {{ props.configured === 4 ? "Replace the keystore" : "Add a keystore" }}
    </Button>

    <form
      v-else
      class="bg-surface space-y-4 rounded-md border p-4"
      autocomplete="off"
      @submit.prevent="upload"
    >
      <FieldGroup class="gap-4">
        <Field>
          <FieldLabel for="ks-file">Keystore</FieldLabel>
          <Input
            id="ks-file"
            :key="fileKey"
            type="file"
            accept=".jks,.keystore,.p12,.pfx,application/x-java-keystore,application/x-pkcs12"
            @change="pick"
          />
          <FieldDescription>.jks, .keystore or .p12, up to 36 KB.</FieldDescription>
        </Field>
        <div class="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel for="ks-alias">Key alias</FieldLabel>
            <Input id="ks-alias" v-model="alias" class="font-mono" spellcheck="false" />
          </Field>
          <Field>
            <FieldLabel for="ks-store-password">Keystore password</FieldLabel>
            <Input
              id="ks-store-password"
              v-model="storePassword"
              type="password"
              autocomplete="new-password"
            />
          </Field>
        </div>
        <Field orientation="horizontal">
          <Checkbox
            id="ks-same"
            :model-value="samePassword"
            @update:model-value="samePassword = $event === true"
          />
          <FieldLabel for="ks-same" class="font-normal">The key uses the same password</FieldLabel>
        </Field>
        <Field v-if="!samePassword">
          <FieldLabel for="ks-key-password">Key password</FieldLabel>
          <Input
            id="ks-key-password"
            v-model="keyPassword"
            type="password"
            autocomplete="new-password"
          />
        </Field>
      </FieldGroup>
      <p v-if="problem" class="text-destructive text-sm">{{ problem }}</p>
      <ErrorNotice v-if="props.store.error.value" :error="props.store.error.value" />
      <div class="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          @click="
            clear();
            open = false;
          "
          >Cancel</Button
        >
        <Button type="submit" size="sm" :disabled="!ready || props.store.isPending.value">
          <Spinner v-if="props.store.isPending.value" />
          Seal and store
        </Button>
      </div>
    </form>
  </div>
</template>
