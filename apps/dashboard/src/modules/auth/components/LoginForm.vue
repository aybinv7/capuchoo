<script setup lang="ts">
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { useLogin } from "../composables/useLogin";

const email = ref("");
const password = ref("");
const login = useLogin();

const ready = computed(
  () => email.value.includes("@") && password.value.length > 0 && !login.isPending.value,
);

function submit() {
  if (!ready.value) return;
  login.mutate({ email: email.value.trim(), password: password.value });
}
</script>

<template>
  <form novalidate @submit.prevent="submit">
    <FieldGroup class="gap-5">
      <Field>
        <FieldLabel for="email">Email</FieldLabel>
        <Input id="email" v-model="email" type="email" autocomplete="username" autofocus required />
      </Field>
      <Field>
        <FieldLabel for="password">Password</FieldLabel>
        <Input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </Field>
      <ErrorNotice v-if="login.error.value" :error="login.error.value" />
      <Button type="submit" class="w-full" :disabled="!ready">
        <Spinner v-if="login.isPending.value" />
        Sign in
      </Button>
    </FieldGroup>
  </form>
</template>
