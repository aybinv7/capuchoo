<template>
  <F7Page class="cap-page sign-in" no-navbar>
    <div class="flex min-h-full flex-col justify-center gap-8 px-6 pb-10 pt-16">
      <SignInHero />

      <div class="flex flex-col items-center gap-2 text-center">
        <h1 class="text-[32px] leading-10 font-bold tracking-tight">{{ t("signIn.title") }}</h1>
        <p class="max-w-72 text-base text-muted-foreground">{{ t("signIn.subtitle") }}</p>
      </div>

      <form class="flex flex-col gap-1" @submit.prevent="onSubmit">
        <F7List strong-ios outline-ios class="m-0!">
          <F7ListInput
            v-model:value="endpoint"
            :label="t('signIn.server')"
            type="url"
            inputmode="url"
            autocomplete="url"
            :placeholder="t('signIn.serverPlaceholder')"
          >
            <template #media><F7Icon md="material:dns" /></template>
          </F7ListInput>
          <F7ListInput
            v-model:value="email"
            :label="t('signIn.email')"
            type="email"
            inputmode="email"
            autocomplete="username"
            clear-button
          >
            <template #media><F7Icon md="material:mail" /></template>
          </F7ListInput>
          <F7ListInput
            v-model:value="password"
            :label="t('signIn.password')"
            type="password"
            autocomplete="current-password"
          >
            <template #media><F7Icon md="material:lock" /></template>
          </F7ListInput>
        </F7List>

        <Transition name="cap-fade">
          <p v-if="error" role="alert" class="mx-1 mt-3 rounded-md bg-destructive-container px-4 py-3 text-sm text-destructive-container-foreground">
            {{ error }}
          </p>
        </Transition>

        <F7Button
          large
          fill
          round
          type="submit"
          class="mt-6 h-14! text-base! font-semibold!"
          :disabled="!canSubmit"
        >
          <LoadingIndicator v-if="busy" :size="28" :label="t('signIn.signingIn')" class="text-primary-foreground!" />
          <span v-else>{{ t("signIn.submit") }}</span>
        </F7Button>
      </form>

      <p class="text-center text-xs text-muted-foreground">{{ t("signIn.footnote") }}</p>
    </div>
  </F7Page>
</template>

<script setup lang="ts">
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import SignInHero from "../components/SignInHero.vue";
import { useSignIn } from "../composables/useSignIn";

const { t } = useI18n();
const { endpoint, email, password, busy, error, canSubmit, submit } = useSignIn();

async function onSubmit(): Promise<void> {
  if (busy.value) return;
  await submit();
}
</script>
