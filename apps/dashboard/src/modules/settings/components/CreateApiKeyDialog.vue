<script setup lang="ts">
import { APP_ROLE_ORDER, describeCap, type AppRole } from "@capuchoo/core";
import { TriangleAlert } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import CopyField from "@/shared/components/CopyField.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { useSession } from "@/shared/composables/useSession";
import type { useApiKeys } from "../composables/useApiKeys";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ create: ReturnType<typeof useApiKeys>["create"] }>();

const { apps } = useSession();
const name = ref("");
const appId = ref("");
const role = ref<AppRole | "">("developer");
const expiry = ref("90");
const secret = ref<string | null>(null);

const ROLES = [...APP_ROLE_ORDER].reverse();

watch(open, (value) => {
  if (!value) {
    secret.value = null;
    return;
  }
  props.create.reset();
  name.value = "";
  appId.value = "";
  role.value = "developer";
  expiry.value = "90";
});

const ready = computed(() => name.value.trim().length > 0 && !props.create.isPending.value);

function submit() {
  if (!ready.value) return;
  props.create.mutate(
    {
      name: name.value.trim(),
      app_id: appId.value || null,
      role: role.value || null,
      ...(expiry.value ? { expires_in_days: Number(expiry.value) } : {}),
    },
    {
      onSuccess: (created) => {
        secret.value = created.key;
      },
    },
  );
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ secret ? "Copy the key now" : "New API key" }}</DialogTitle>
        <DialogDescription>
          {{
            secret
              ? "This is the only time the key is shown. Store it in your CI secrets."
              : "For the CLI and CI. A key acts as you, never with more than you have."
          }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="secret" class="space-y-4">
        <CopyField :value="secret" label="API key" />
        <Alert class="border-warning/40">
          <TriangleAlert />
          <AlertTitle>It cannot be shown again</AlertTitle>
          <AlertDescription>
            The server keeps only a hash. If it is lost, revoke it and create another.
          </AlertDescription>
        </Alert>
      </div>

      <form v-else id="create-key" novalidate @submit.prevent="submit">
        <FieldGroup class="gap-4">
          <Field>
            <FieldLabel for="key-name">Name</FieldLabel>
            <Input
              id="key-name"
              v-model="name"
              maxlength="120"
              placeholder="gitlab-ci field app"
              autofocus
            />
          </Field>
          <Field>
            <FieldLabel for="key-app">Limited to app</FieldLabel>
            <NativeSelect id="key-app" v-model="appId">
              <NativeSelectOption value="">Every app I can reach</NativeSelectOption>
              <NativeSelectOption v-for="app in apps" :key="app.id" :value="app.id"
                >{{ app.name }} · {{ app.app_id }}</NativeSelectOption
              >
            </NativeSelect>
            <FieldDescription>A limited key cannot see or manage anything else.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel for="key-role">Role cap</FieldLabel>
            <NativeSelect id="key-role" v-model="role">
              <NativeSelectOption v-for="cap in ROLES" :key="cap" :value="cap">{{
                describeCap(cap)
              }}</NativeSelectOption>
              <NativeSelectOption value="">{{ describeCap(null) }}</NativeSelectOption>
            </NativeSelect>
            <FieldDescription
              >The key acts with the weaker of this cap and your own role.</FieldDescription
            >
          </Field>
          <Field>
            <FieldLabel for="key-expiry">Expires</FieldLabel>
            <NativeSelect id="key-expiry" v-model="expiry">
              <NativeSelectOption value="30">In 30 days</NativeSelectOption>
              <NativeSelectOption value="90">In 90 days</NativeSelectOption>
              <NativeSelectOption value="365">In a year</NativeSelectOption>
              <NativeSelectOption value="">Never</NativeSelectOption>
            </NativeSelect>
          </Field>
          <ErrorNotice v-if="props.create.error.value" :error="props.create.error.value" />
        </FieldGroup>
      </form>

      <DialogFooter>
        <Button v-if="secret" @click="open = false">I stored it</Button>
        <template v-else>
          <Button variant="outline" @click="open = false">Cancel</Button>
          <Button type="submit" form="create-key" :disabled="!ready">
            <Spinner v-if="props.create.isPending.value" />
            Create key
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
