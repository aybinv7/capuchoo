<template>
  <F7Page class="cap-page sign-in" no-navbar>
    <form
      class="flex min-h-full flex-col px-6 pt-[calc(var(--f7-safe-area-top)+32px)] pb-6"
      @submit.prevent="onSubmit"
    >
      <MaterialShape
        shape="cookie12"
        class="mark grid size-16 place-items-center bg-primary-container text-primary-container-foreground"
      >
        <F7Icon md="material:rocket_launch" size="30" />
      </MaterialShape>

      <h1 class="mt-6 mb-0 text-[36px] leading-[44px] font-bold tracking-tight">
        {{ t("signIn.title") }}
      </h1>
      <p class="mt-2 mb-0 text-base text-muted-foreground">{{ t("signIn.subtitle") }}</p>

      <button
        v-if="!editingServer"
        type="button"
        class="server-chip mt-6"
        :aria-label="t('signIn.changeServer')"
        @click="editServer"
      >
        <F7Icon md="material:dns" size="18" class="material-icons-outlined" />
        <span class="cap-mono min-w-0 flex-1 truncate text-start">{{
          serverHost || t("signIn.noServer")
        }}</span>
        <span class="font-semibold text-primary">{{ t("signIn.change") }}</span>
      </button>

      <F7List class="fields mt-4! mb-0!" no-hairlines>
        <F7ListInput
          v-if="editingServer"
          v-model:value="endpoint"
          :label="t('signIn.server')"
          type="url"
          inputmode="url"
          autocomplete="url"
          :placeholder="t('signIn.serverPlaceholder')"
        >
          <template #media><F7Icon md="material:dns" class="material-icons-outlined" /></template>
        </F7ListInput>
        <F7ListInput
          v-model:value="email"
          :label="t('signIn.email')"
          type="email"
          inputmode="email"
          autocomplete="username"
          autocapitalize="off"
        >
          <template #media><F7Icon md="material:mail" class="material-icons-outlined" /></template>
        </F7ListInput>
        <F7ListInput
          v-model:value="password"
          :label="t('signIn.password')"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
        >
          <template #media><F7Icon md="material:lock" class="material-icons-outlined" /></template>
          <template #inner-end>
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
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import { normaliseEndpoint, useSignIn } from "../composables/useSignIn";

/**
 * Sign-in as Google's own account screens lay it out: the mark, a headline, the two fields, and
 * the action on the bottom edge within reach of the thumb. The server is shown, not asked: almost
 * everyone uses the one prefilled, so it is a line to read with a way to change it.
 */
const { t } = useI18n();
const { endpoint, email, password, busy, error, canSubmit, submit } = useSignIn();

const showPassword = ref(false);
const editingServer = ref(!normaliseEndpoint(endpoint.value));
const serverHost = computed(
  () => normaliseEndpoint(endpoint.value)?.replace(/^https?:\/\//, "") ?? "",
);

function editServer(): void {
  editingServer.value = true;
}

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
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  padding-inline: 16px;
  border-radius: var(--radius-lg);
  background: var(--secondary);
  color: var(--secondary-foreground);
  font-size: 14px;
}

.server-chip:active {
  background: color-mix(in srgb, var(--secondary-foreground) 12%, var(--secondary));
}

/* The fields sit on the page, not in a card: each is its own M3 filled text field. */
.fields {
  --f7-list-bg-color: transparent;
  --f7-list-margin-vertical: 0px;
}

.fields :deep(ul) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fields :deep(.item-content) {
  padding-inline-start: 0;
}

.reveal {
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
