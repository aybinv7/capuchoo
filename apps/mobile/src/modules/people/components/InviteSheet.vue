<template>
  <F7Sheet
    class="people-sheet"
    :opened="opened"
    swipe-to-close
    backdrop
    close-by-backdrop-click
    @sheet:closed="onClosed"
  >
    <div class="swipe-handler" />
    <F7PageContent class="people-sheet-content">
      <template v-if="step === 'form'">
        <div class="px-6 pt-1 pb-2">
          <p class="m-0 text-[22px] leading-7 font-semibold">{{ t("people.inviteTitle") }}</p>
          <p class="mt-1 mb-0 text-sm text-muted-foreground">
            {{ t("people.inviteText", { app: appName }) }}
          </p>
        </div>
        <F7List class="auth-fields mx-4! mt-2! mb-0!" no-hairlines>
          <F7ListInput
            v-model:value="email"
            :label="t('people.email')"
            type="email"
            inputmode="email"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            clear-button
          />
        </F7List>
        <F7BlockTitle>{{ t("people.roleOn", { app: appName }) }}</F7BlockTitle>
        <RoleOptions v-model="role" :roles="APP_ROLE_ORDER" name="invite-role" />
      </template>

      <div v-else-if="step === 'no-account'" class="flex flex-col gap-3 px-6 pt-1 pb-2">
        <MaterialShape
          shape="flower"
          class="grid size-16 place-items-center bg-tertiary text-tertiary-foreground"
        >
          <F7Icon md="material:person_add" size="30" />
        </MaterialShape>
        <p class="m-0 text-[22px] leading-7 font-semibold">{{ t("people.noAccountTitle") }}</p>
        <p class="m-0 text-sm leading-5 text-muted-foreground">
          {{ t("people.noAccountText", { email: email.trim(), org: organization ?? appName }) }}
        </p>
      </div>

      <div v-else class="flex flex-col gap-3 px-6 pt-1 pb-2">
        <MaterialShape
          shape="sunny"
          class="grid size-16 place-items-center bg-env-prod-container text-env-prod-foreground"
        >
          <F7Icon md="material:schedule_send" size="30" />
        </MaterialShape>
        <p class="m-0 text-[22px] leading-7 font-semibold">{{ t("people.linkTitle") }}</p>
        <p class="m-0 text-sm leading-5 text-muted-foreground">
          {{ t("people.linkText", { email: email.trim(), role: t(`roles.name.${role}`) }) }}
        </p>
        <p class="cap-mono cap-selectable m-0 rounded-2xl bg-muted px-4 py-3 text-xs break-all">
          {{ link }}
        </p>
      </div>

      <Transition name="cap-fade">
        <p
          v-if="error"
          role="alert"
          class="mx-4 mt-3 mb-0 flex items-start gap-2 rounded-2xl bg-destructive-container px-4 py-3 text-sm text-destructive-container-foreground"
        >
          <F7Icon md="material:error" size="20" class="shrink-0" />
          <span>{{ error }}</span>
        </p>
      </Transition>

      <div class="flex flex-col gap-2 px-4 pt-4">
        <template v-if="step === 'form'">
          <F7Button
            large
            fill
            round
            class="font-semibold!"
            :class="{ disabled: busy || !valid }"
            @click="submit"
          >
            {{ t("people.inviteAction") }}
          </F7Button>
        </template>
        <template v-else-if="step === 'no-account'">
          <F7Button
            large
            fill
            round
            class="font-semibold!"
            :class="{ disabled: busy }"
            @click="createLink"
          >
            {{ t("people.createLink") }}
          </F7Button>
          <F7Button large round class="font-semibold!" @click="step = 'form'">
            {{ t("people.back") }}
          </F7Button>
        </template>
        <template v-else>
          <F7Button large fill round class="font-semibold!" @click="share">
            <F7Icon md="material:share" size="20" class="me-2" />
            {{ t("people.share") }}
          </F7Button>
          <F7Button large tonal round class="font-semibold!" @click="copy">
            <F7Icon md="material:content_copy" size="20" class="me-2" />
            {{ t("people.copy") }}
          </F7Button>
        </template>
      </div>
    </F7PageContent>
  </F7Sheet>
</template>

<script setup lang="ts">
import { APP_ROLE_ORDER } from "@capuchoo/core";
import RoleOptions from "@/shared/components/app/RoleOptions.vue";
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import type { AppRole } from "@/shared/database/schema";
import type { AddOutcome } from "../composables/usePeople";
import { copyLink, shareLink } from "../lib/shareLink";

type Step = "form" | "no-account" | "link";

/**
 * Inviting in the server's two moves: an address with an account gets the role at once; one
 * without gets an organization invitation, created only when the admin asks, as a link they send
 * themselves - the server mails nothing. The role is given once the person has joined.
 */
const props = defineProps<{
  opened: boolean;
  appName: string;
  organization: string | null;
  setRole: (email: string, role: AppRole) => Promise<AddOutcome>;
  invite: (email: string) => Promise<string>;
}>();
const emit = defineEmits<{ close: []; granted: [email: string, role: AppRole] }>();
const { t } = useI18n();

const step = ref<Step>("form");
const email = ref("");
const role = ref<AppRole>("tester");
const link = ref("");
const busy = ref(false);
const error = ref<string | null>(null);

const valid = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim()));

watch(email, () => (error.value = null));

async function run(work: () => Promise<void>): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await work();
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : String(failure);
  } finally {
    busy.value = false;
  }
}

function submit(): void {
  if (!valid.value || busy.value) return;
  void run(async () => {
    const outcome = await props.setRole(email.value, role.value);
    if (outcome === "granted") {
      emit("granted", email.value.trim(), role.value);
      emit("close");
    } else step.value = "no-account";
  });
}

function createLink(): void {
  if (busy.value) return;
  void run(async () => {
    link.value = await props.invite(email.value);
    step.value = "link";
  });
}

function share(): void {
  void run(() =>
    shareLink({
      title: t("people.shareTitle"),
      text: t("people.shareText", { app: props.appName }),
      url: link.value,
    }),
  );
}

function copy(): void {
  void run(async () => {
    await copyLink(link.value);
    f7.toast.create({ text: t("people.copied"), closeTimeout: 2400, position: "bottom" }).open();
  });
}

function onClosed(): void {
  step.value = "form";
  email.value = "";
  link.value = "";
  error.value = null;
  emit("close");
}
</script>
