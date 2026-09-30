<script setup lang="ts">
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { isApiError } from "@/shared/api/errors";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/shared/lib/password";
import type { useInvitation } from "../composables/useInvitation";
import type { InvitationPreview } from "../types/auth.types";

const props = defineProps<{
  invitation: InvitationPreview;
  accept: ReturnType<typeof useInvitation>["accept"];
}>();

const fullName = ref("");
const password = ref("");
const touched = ref(false);

const existingAccount = computed(
  () => isApiError(props.accept.error.value) && props.accept.error.value.status === 401,
);
const problem = computed(() => (existingAccount.value ? null : passwordProblem(password.value)));
const ready = computed(
  () => password.value.length > 0 && !problem.value && !props.accept.isPending.value,
);

function submit() {
  touched.value = true;
  if (!ready.value) return;
  props.accept.mutate({ password: password.value, full_name: fullName.value.trim() || null });
}
</script>

<template>
  <form novalidate @submit.prevent="submit">
    <FieldGroup class="gap-5">
      <Field>
        <FieldLabel for="invite-email">Email</FieldLabel>
        <Input
          id="invite-email"
          :model-value="props.invitation.email"
          readonly
          autocomplete="username"
        />
      </Field>
      <Field>
        <FieldLabel for="invite-name">Full name</FieldLabel>
        <Input id="invite-name" v-model="fullName" autocomplete="name" maxlength="120" />
      </Field>
      <Field :data-invalid="touched && problem ? true : undefined">
        <FieldLabel for="invite-password">Password</FieldLabel>
        <Input
          id="invite-password"
          v-model="password"
          type="password"
          autocomplete="new-password"
          :aria-invalid="touched && Boolean(problem)"
        />
        <FieldDescription>
          At least {{ MIN_PASSWORD_LENGTH }} characters. If this email already has an account, enter
          its current password instead.
        </FieldDescription>
        <FieldError v-if="touched && problem">{{ problem }}</FieldError>
      </Field>
      <ErrorNotice v-if="props.accept.error.value" :error="props.accept.error.value" />
      <Button type="submit" class="w-full" :disabled="props.accept.isPending.value">
        <Spinner v-if="props.accept.isPending.value" />
        Join {{ props.invitation.organization }}
      </Button>
    </FieldGroup>
  </form>
</template>
