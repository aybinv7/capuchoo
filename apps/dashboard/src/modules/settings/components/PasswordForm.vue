<script setup lang="ts">
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/shared/lib/password";
import { useProfile } from "../composables/useProfile";
import SettingsSection from "./SettingsSection.vue";

const { password } = useProfile();
const current = ref("");
const next = ref("");
const confirm = ref("");

const problem = computed(() => (next.value ? passwordProblem(next.value) : null));
const mismatch = computed(() => Boolean(confirm.value) && confirm.value !== next.value);
const ready = computed(
  () =>
    Boolean(current.value && next.value) &&
    !problem.value &&
    !mismatch.value &&
    !password.isPending.value,
);

function submit() {
  if (!ready.value) return;
  password.mutate(
    { current: current.value, next: next.value },
    {
      onSuccess: () => {
        toast.success("Password changed", { description: "Your other sessions were signed out." });
        current.value = "";
        next.value = "";
        confirm.value = "";
      },
    },
  );
}
</script>

<template>
  <SettingsSection
    title="Password"
    description="Changing it signs out every other session of this account."
  >
    <form id="password-form" novalidate @submit.prevent="submit">
      <FieldGroup class="max-w-md gap-4">
        <input
          type="text"
          autocomplete="username"
          class="hidden"
          aria-hidden="true"
          tabindex="-1"
        />
        <Field>
          <FieldLabel for="password-current">Current password</FieldLabel>
          <Input
            id="password-current"
            v-model="current"
            type="password"
            autocomplete="current-password"
          />
        </Field>
        <Field :data-invalid="problem ? true : undefined">
          <FieldLabel for="password-next">New password</FieldLabel>
          <Input id="password-next" v-model="next" type="password" autocomplete="new-password" />
          <FieldDescription>At least {{ MIN_PASSWORD_LENGTH }} characters.</FieldDescription>
          <FieldError v-if="problem">{{ problem }}</FieldError>
        </Field>
        <Field :data-invalid="mismatch ? true : undefined">
          <FieldLabel for="password-confirm">Repeat the new password</FieldLabel>
          <Input
            id="password-confirm"
            v-model="confirm"
            type="password"
            autocomplete="new-password"
          />
          <FieldError v-if="mismatch">The two new passwords differ.</FieldError>
        </Field>
        <ErrorNotice v-if="password.error.value" :error="password.error.value" />
      </FieldGroup>
    </form>
    <template #footer>
      <Button type="submit" form="password-form" :disabled="!ready">
        <Spinner v-if="password.isPending.value" />
        Change password
      </Button>
    </template>
  </SettingsSection>
</template>
