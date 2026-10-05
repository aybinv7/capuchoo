<template>
  <F7Page class="cap-page cap-pushed auth-page">
    <F7Navbar back-link class="navbar-gradient" />

    <form class="flex min-h-full flex-col px-6 pt-2 pb-6" novalidate @submit.prevent="onSubmit">
      <MaterialShape
        shape="cookie12"
        class="mark grid size-16 place-items-center bg-primary-container text-primary-container-foreground"
      >
        <F7Icon md="material:person" size="30" />
      </MaterialShape>

      <StepKicker :step="2" :total="2" class="mt-6" />
      <h1 class="mt-3 mb-0 text-[32px] leading-10 font-bold tracking-tight">
        {{ t("signIn.account.title") }}
      </h1>

      <F7Link back class="server-chip mt-4" :aria-label="t('signIn.changeServer')" @click="tick">
        <F7Icon md="material:cloud_done" size="18" class="text-env-prod" />
        <span class="cap-mono min-w-0 flex-1 truncate text-start">{{ host }}</span>
        <span class="font-semibold text-primary">{{ t("signIn.change") }}</span>
      </F7Link>

      <F7List class="auth-fields mt-6! mb-0!" no-hairlines>
        <F7ListInput
          v-model:value="email"
          :label="t('signIn.email')"
          type="email"
          inputmode="email"
          autocomplete="username"
          autocapitalize="off"
          spellcheck="false"
          clear-button
        />
        <F7ListInput
          v-model:value="password"
          :label="t('signIn.password')"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          autocapitalize="off"
          spellcheck="false"
        >
          <template #content-end>
            <F7Link
              icon-only
              class="reveal"
              :aria-label="showPassword ? t('signIn.hidePassword') : t('signIn.showPassword')"
              @click="showPassword = !showPassword"
            >
              <F7Icon
                :md="showPassword ? 'material:visibility_off' : 'material:visibility'"
                size="22"
              />
            </F7Link>
          </template>
        </F7ListInput>
      </F7List>

      <Transition name="cap-fade">
        <p
          v-if="error"
          role="alert"
          class="mt-4 mb-0 flex items-start gap-2 rounded-2xl bg-destructive-container px-4 py-3 text-sm text-destructive-container-foreground"
        >
          <F7Icon md="material:error" size="20" class="shrink-0" />
          <span>{{ error }}</span>
        </p>
      </Transition>

      <div class="min-h-8 flex-1" />

      <F7Button
        large
        fill
        round
        type="submit"
        class="h-14! text-base! font-semibold!"
        :disabled="!canSubmit"
      >
        <LoadingIndicator
          v-if="busy"
          :size="28"
          :label="t('signIn.signingIn')"
          class="text-primary-foreground!"
        />
        <span v-else>{{ t("signIn.submit") }}</span>
      </F7Button>
      <p class="mt-4 mb-0 text-center text-xs leading-5 text-muted-foreground">
        {{ t("signIn.footnote") }}
      </p>
    </form>
  </F7Page>
</template>

<script setup lang="ts">
import type { Router } from "framework7/types";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import { tick } from "@/shared/utils/native/haptics";
import StepKicker from "../components/StepKicker.vue";
import { useAccountStep } from "../composables/useAccountStep";
import { hostOf } from "../lib/endpoint";

/**
 * Sign-in, step two: the account, on the server step one confirmed. The server stays in view as a
 * chip, and changing it goes back a step rather than opening a field here.
 */
const props = defineProps<{ f7router: Router.Router }>();
const { t } = useI18n();
const { server, email, password, busy, error, canSubmit, submit } = useAccountStep();
const showPassword = ref(false);

const host = computed(() => (server.value ? hostOf(server.value) : ""));

onMounted(() => {
  if (!server.value) props.f7router.back("/sign-in/", { force: true });
});

async function onSubmit(): Promise<void> {
  if (busy.value) return;
  await submit();
}
</script>

<style scoped>
.mark {
  animation: mark-in 640ms var(--ease-spring-fast) both;
}

.server-chip {
  display: flex;
  justify-content: flex-start;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  padding-inline: 16px;
  border-radius: var(--radius-lg);
  background: var(--secondary);
  color: var(--secondary-foreground);
  font-size: 14px;
}

.reveal {
  align-self: center;
  color: var(--muted-foreground);
  margin-inline-end: 4px;
}

@keyframes mark-in {
  from {
    transform: scale(0.3) rotate(-90deg);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mark {
    animation: none;
  }
}
</style>
