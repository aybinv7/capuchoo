<script setup lang="ts">
import { ShieldCheck, ShieldOff } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import CopyField from "@/shared/components/CopyField.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import SettingsSection from "../components/SettingsSection.vue";
import { useSigning } from "../composables/useSigning";

const { appId } = useCurrentApp();
const permissions = useAppPermissions();
const { signing, save } = useSigning(appId);
const editable = computed(() => permissions.isAdmin.value);

const publicKey = ref("");
const required = ref(false);

watch(
  () => signing.data.value,
  (value) => {
    publicKey.value = value?.public_key ?? "";
    required.value = value?.require_signature ?? false;
  },
  { immediate: true },
);

const trimmed = computed(() => publicKey.value.trim());
const dirty = computed(
  () =>
    trimmed.value !== (signing.data.value?.public_key ?? "") ||
    required.value !== (signing.data.value?.require_signature ?? false),
);
const problem = computed(() =>
  required.value && !trimmed.value ? "A required signature needs a public key." : null,
);

function submit() {
  if (problem.value) return;
  save.mutate(
    { public_key: trimmed.value || null, require_signature: required.value },
    { onSuccess: () => toast.success("Signing settings saved") },
  );
}
</script>

<template>
  <ErrorNotice v-if="signing.error.value" :error="signing.error.value" :retry="signing.refetch" />
  <Skeleton v-else-if="signing.isPending.value" class="h-48 w-full" />
  <SettingsSection
    v-else
    title="Release signing"
    description="The CLI signs each artefact with the private key; the server checks the signature against this public key, and the updater checks it again on the device before applying anything."
  >
    <div class="mb-5 flex items-center gap-3 text-sm">
      <template v-if="signing.data.value?.fingerprint">
        <ShieldCheck class="text-success size-5" />
        <div class="min-w-0 flex-1">
          <div class="font-medium">
            Key configured, signatures
            {{ signing.data.value.require_signature ? "required" : "optional" }}
          </div>
          <CopyField :value="signing.data.value.fingerprint" label="Fingerprint" class="mt-1.5" />
        </div>
      </template>
      <template v-else>
        <ShieldOff class="text-muted-foreground size-5" />
        <span class="text-muted-foreground">No public key. Uploads are accepted unsigned.</span>
      </template>
    </div>
    <FieldGroup class="gap-5">
      <Field>
        <FieldLabel for="public-key">Public key</FieldLabel>
        <Textarea
          id="public-key"
          v-model="publicKey"
          rows="5"
          class="font-mono text-xs"
          placeholder="-----BEGIN PUBLIC KEY-----"
          spellcheck="false"
          :disabled="!editable"
        />
        <FieldDescription>
          ECDSA P-256, base64 SPKI or PEM. The private half stays with the CLI, in
          <code class="font-mono">CAPUCHOO_SIGNING_KEY</code> or
          <code class="font-mono">.capuchoo/signing-key.pem</code>, never here.
        </FieldDescription>
      </Field>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel for="require-signature">Require a signature</FieldLabel>
          <FieldDescription>Refuse every unsigned or wrongly signed upload.</FieldDescription>
        </FieldContent>
        <Switch id="require-signature" v-model="required" :disabled="!editable" />
      </Field>
      <p v-if="problem" class="text-destructive text-sm">
        {{ problem }}
      </p>
      <ErrorNotice v-if="save.error.value" :error="save.error.value" />
    </FieldGroup>
    <template v-if="editable" #footer>
      <Button :disabled="!dirty || Boolean(problem) || save.isPending.value" @click="submit">
        <Spinner v-if="save.isPending.value" />
        Save
      </Button>
    </template>
  </SettingsSection>
</template>
