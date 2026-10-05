<template>
  <F7Page class="cap-page cap-pushed">
    <F7Navbar
      :title="t('people.title')"
      :subtitle="app?.name"
      back-link
      class="navbar-gradient"
      :sliding="true"
    />

    <template #fixed>
      <PullToRefresh :tables="[]" :action="load" />
    </template>

    <F7Toolbar v-if="app && allowed" bottom>
      <div class="flex w-full px-3">
        <F7Button fill round large class="flex-1 font-semibold!" @click="inviting = true">
          <F7Icon md="material:person_add" size="20" class="me-2" />
          {{ t("people.invite") }}
        </F7Button>
      </div>
    </F7Toolbar>

    <EmptyState
      v-if="app && !allowed"
      icon="admin_panel_settings"
      :title="t('people.adminOnlyTitle')"
      :text="t('people.adminOnlyText')"
    />

    <div v-else-if="loading && !withAccess.length" class="grid place-items-center py-24">
      <LoadingIndicator contained :size="56" :label="t('people.loading')" />
    </div>

    <EmptyState
      v-else-if="error && !withAccess.length"
      icon="cloud_off"
      :title="t('people.failed')"
      :text="error"
    >
      <F7Button tonal round class="w-auto! px-6!" @click="load">{{ t("common.refresh") }}</F7Button>
    </EmptyState>

    <template v-else>
      <F7BlockTitle>{{ t("people.onApp", { app: app?.name ?? "" }) }}</F7BlockTitle>
      <F7List strong inset dividers media-list class="rounded-2xl!">
        <PersonListItem
          v-for="person in withAccess"
          :key="person.userId"
          :person="person"
          :self="person.userId === account?.id"
          :disabled="person.userId === account?.id"
          @open="editing = person"
        />
      </F7List>
      <F7BlockFooter>{{ t("people.selfHint") }}</F7BlockFooter>

      <template v-if="withoutAccess.length">
        <F7BlockTitle>{{ t("people.inOrg", { org: organization ?? "" }) }}</F7BlockTitle>
        <F7List strong inset dividers media-list class="rounded-2xl!">
          <PersonListItem
            v-for="person in withoutAccess"
            :key="person.userId"
            :person="person"
            @open="editing = person"
          />
        </F7List>
      </template>

      <template v-if="invitations?.length">
        <F7BlockTitle>{{ t("people.pending") }}</F7BlockTitle>
        <F7List strong inset dividers media-list class="rounded-2xl!">
          <F7ListItem
            v-for="invitation in invitations"
            :key="invitation.id"
            :title="invitation.email"
            :subtitle="t('people.expires', { when: formatRelative(invitation.expires_at, locale) })"
            link="#"
            :no-chevron="true"
            @click="confirmCancel(invitation)"
          >
            <template #media>
              <MaterialShape
                shape="pentagon"
                class="grid size-10 place-items-center bg-muted text-muted-foreground"
              >
                <F7Icon md="material:hourglass_empty" size="20" />
              </MaterialShape>
            </template>
          </F7ListItem>
        </F7List>
        <F7BlockFooter>{{ t("people.pendingHint") }}</F7BlockFooter>
      </template>
    </template>

    <PersonSheet
      :person="editing"
      :app-name="app?.name ?? ''"
      :busy="busy"
      @close="editing = null"
      @save="saveRole"
      @remove="confirmRemove"
    />
    <InviteSheet
      :opened="inviting"
      :app-name="app?.name ?? ''"
      :organization="organization"
      :set-role="setRole"
      :invite="invite"
      @close="inviting = false"
      @granted="onGranted"
    />
  </F7Page>
</template>

<script setup lang="ts">
import type { Router } from "framework7/types";
import { listOrganizations } from "@/domains/catalog/catalog.repository";
import { can } from "@/shared/access/capabilities";
import type { ServerInvitation } from "@/shared/api/types";
import EmptyState from "@/shared/components/app/EmptyState.vue";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import PullToRefresh from "@/shared/components/refresh/PullToRefresh.vue";
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import { useCurrentApp } from "@/shared/composables/apps/useCurrentApp";
import { getDatabase, useReactiveQuery } from "@/shared/database";
import type { AppRole } from "@/shared/database/schema";
import { formatRelative } from "@/shared/utils/format";
import InviteSheet from "../components/InviteSheet.vue";
import PersonListItem from "../components/PersonListItem.vue";
import PersonSheet from "../components/PersonSheet.vue";
import { usePeople, type Person } from "../composables/usePeople";

/**
 * Who works on the app and with what role, for its admins: change a role, take it away, give one
 * to an organization member, or invite someone new. The admin's own row is left alone, so nobody
 * locks themselves out from a phone.
 */
defineProps<{ f7router: Router.Router }>();
useHiddenTabbar();
const { t, locale } = useI18n();

const { app, account } = useCurrentApp();
const allowed = computed(() => Boolean(app.value && can.manageAccess(app.value)));
const {
  withAccess,
  withoutAccess,
  invitations,
  loading,
  error,
  load,
  setRole,
  invite,
  revoke,
  cancelInvitation,
} = usePeople(app);

const orgs = useReactiveQuery(() => listOrganizations(getDatabase().db), {
  tables: ["organization"],
  queryKey: ["organizations"],
});
const organization = computed(
  () => orgs.data.value?.find((org) => org.id === app.value?.organization_id)?.name ?? null,
);

const editing = ref<Person | null>(null);
const inviting = ref(false);
const busy = ref(false);

watch(
  () => (allowed.value ? app.value?.id : null),
  (id) => id && void load(),
  { immediate: true },
);

function toast(text: string): void {
  f7.toast.create({ text, closeTimeout: 3000, position: "bottom" }).open();
}

async function act(work: () => Promise<unknown>, done: string): Promise<void> {
  busy.value = true;
  try {
    await work();
    editing.value = null;
    toast(done);
  } catch (failure) {
    toast(failure instanceof Error ? failure.message : String(failure));
  } finally {
    busy.value = false;
  }
}

function saveRole(role: AppRole): void {
  const person = editing.value;
  if (!person) return;
  void act(
    () => setRole(person.email, role),
    t("people.roleSet", { name: person.name, role: t(`roles.name.${role}`) }),
  );
}

function confirmRemove(): void {
  const person = editing.value;
  if (!person) return;
  f7.dialog
    .create({
      title: t("people.removeTitle", { name: person.name }),
      text: t("people.removeText", { app: app.value?.name ?? "" }),
      buttons: [
        { text: t("common.cancel") },
        {
          text: t("people.remove"),
          strong: true,
          cssClass: "dialog-button-danger",
          onClick: () => void act(() => revoke(person), t("people.removed", { name: person.name })),
        },
      ],
    })
    .open();
}

function confirmCancel(invitation: ServerInvitation): void {
  f7.dialog
    .create({
      title: t("people.cancelTitle", { email: invitation.email }),
      text: t("people.cancelText"),
      buttons: [
        { text: t("common.cancel") },
        {
          text: t("people.cancelInvite"),
          strong: true,
          cssClass: "dialog-button-danger",
          onClick: () => void act(() => cancelInvitation(invitation), t("people.cancelled")),
        },
      ],
    })
    .open();
}

function onGranted(email: string, role: AppRole): void {
  toast(t("people.roleSet", { name: email, role: t(`roles.name.${role}`) }));
}
</script>
