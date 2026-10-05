<template>
  <F7Page class="cap-page cap-pushed auth-page" no-navbar>
    <form
      class="flex min-h-full flex-col px-6 pt-[calc(var(--f7-safe-area-top)+24px)] pb-6"
      novalidate
      @submit.prevent="onContinue"
    >
      <div class="scene-stage">
        <SceneServer :state="sceneState" />
      </div>

      <StepKicker :step="1" :total="2" class="mt-6" />
      <h1 class="mt-3 mb-0 text-[32px] leading-10 font-bold tracking-tight">
        {{ t("signIn.server.title") }}
      </h1>
      <p class="mt-2 mb-0 text-base leading-6 text-muted-foreground">
        {{ t("signIn.server.body") }}
      </p>

      <F7List class="auth-fields mt-6! mb-0!" no-hairlines>
        <F7ListInput
          v-model:value="endpoint"
          :label="t('signIn.server.label')"
          type="url"
          inputmode="url"
          autocomplete="url"
          autocapitalize="off"
          spellcheck="false"
          :placeholder="t('signIn.serverPlaceholder')"
          clear-button
        />
      </F7List>
      <Transition name="cap-fade" mode="out-in">
        <p
          v-if="error"
          role="alert"
          class="mt-3 mb-0 flex items-start gap-2 rounded-2xl bg-destructive-container px-4 py-3 text-sm text-destructive-container-foreground"
        >
          <F7Icon md="material:error" size="20" class="shrink-0" />
          <span>{{ error }}</span>
        </p>
        <p v-else class="mt-2 mb-0 px-4 text-xs leading-5 text-muted-foreground">
          {{ t("signIn.server.hint") }}
        </p>
      </Transition>

      <div class="min-h-8 flex-1" />

      <F7Button
        large
        fill
        round
        type="submit"
        class="h-14! text-base! font-semibold!"
        :disabled="!canContinue"
      >
        <LoadingIndicator
          v-if="busy"
          :size="28"
          :label="t('signIn.server.checking')"
          class="text-primary-foreground!"
        />
        <template v-else>
          {{ t("signIn.next") }}
          <F7Icon md="material:arrow_forward" size="20" class="ms-2" />
        </template>
      </F7Button>
    </form>
  </F7Page>
</template>

<script setup lang="ts">
import type { Router } from "framework7/types";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import SceneServer, { type ServerSceneState } from "../components/SceneServer.vue";
import StepKicker from "../components/StepKicker.vue";
import { useServerStep } from "../composables/useServerStep";

/**
 * Sign-in, step one: where the account lives. It gets its own page because a wrong address is the
 * commonest failure and deserves its own answer, before anyone types a password into it.
 */
const props = defineProps<{ f7router: Router.Router }>();
const { t } = useI18n();
const { endpoint, busy, error, canContinue, check } = useServerStep();
const passed = ref(false);

const sceneState = computed<ServerSceneState>(() =>
  busy.value ? "checking" : error.value ? "error" : passed.value ? "ok" : "idle",
);

watch(endpoint, () => (passed.value = false));

async function onContinue(): Promise<void> {
  if (!(await check())) return;
  passed.value = true;
  props.f7router.navigate("/sign-in/account/", { transition: "cap-end" });
}
</script>

<style scoped>
.scene-stage {
  width: min(100%, 36vh, 340px);
  margin-inline: auto;
}
</style>
