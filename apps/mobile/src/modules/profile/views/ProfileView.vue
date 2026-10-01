<template>
  <F7Page class="cap-page">
    <F7Navbar large :title="t('profile.title')" class="navbar-gradient">
      <F7NavRight><LiveIndicator /></F7NavRight>
    </F7Navbar>

    <F7List v-if="account" strong inset media-list class="rounded-2xl!">
      <F7ListItem
        :title="account.full_name || account.email"
        :subtitle="account.email"
        :text="host"
      >
        <template #media>
          <AppIcon
            :name="account.full_name || account.email"
            :bundle-id="account.email"
            shape="cookie9"
            :size="56"
          />
        </template>
        <template v-if="account.instance_admin" #after>
          <F7Badge class="bg-primary! text-primary-foreground!">{{
            t("profile.instanceAdmin")
          }}</F7Badge>
        </template>
      </F7ListItem>
    </F7List>

    <F7BlockTitle>{{ t("profile.preferences") }}</F7BlockTitle>
    <F7List strong inset dividers class="rounded-2xl!">
      <F7ListItem
        link="/profile/appearance/"
        :title="t('appearance.title')"
        :after="t(`appearance.modes.${theme.mode}`)"
      >
        <template #media
          ><F7Icon md="material:palette" class="material-icons-outlined text-muted-foreground"
        /></template>
      </F7ListItem>
      <F7ListItem
        link="/profile/notifications/"
        :title="t('profile.notifications')"
        :after="notifySummary"
      >
        <template #media
          ><F7Icon
            md="material:notifications"
            class="material-icons-outlined text-muted-foreground"
        /></template>
      </F7ListItem>
    </F7List>

    <template v-if="organizations.length">
      <F7BlockTitle>{{ t("profile.organizations") }}</F7BlockTitle>
      <F7List strong inset dividers class="rounded-2xl!">
        <F7ListItem
          v-for="org in organizations"
          :key="org.id"
          :title="org.name"
          :after="t(`profile.orgRole.${org.role}`)"
        >
          <template #media
            ><F7Icon
              md="material:corporate_fare"
              class="material-icons-outlined text-muted-foreground"
          /></template>
        </F7ListItem>
      </F7List>
    </template>

    <F7BlockTitle>{{ t("profile.phone") }}</F7BlockTitle>
    <F7List strong inset dividers class="rounded-2xl!">
      <F7ListItem :title="t('profile.endpoint')" :after="host">
        <template #media
          ><F7Icon md="material:dns" class="material-icons-outlined text-muted-foreground"
        /></template>
      </F7ListItem>
      <F7ListItem :title="t('profile.version')" :after="version">
        <template #media
          ><F7Icon md="material:info" class="material-icons-outlined text-muted-foreground"
        /></template>
      </F7ListItem>
    </F7List>

    <F7List strong inset class="rounded-2xl!">
      <F7ListButton
        class="list-button-danger"
        :class="{ disabled: signingOut }"
        @click="confirmSignOut"
      >
        {{ t("profile.signOut") }}
      </F7ListButton>
    </F7List>
  </F7Page>
</template>

<script setup lang="ts">
import AppIcon from "@/shared/components/app/AppIcon.vue";
import LiveIndicator from "@/shared/components/app/LiveIndicator.vue";
import { useAppTheme } from "@/shared/composables/theme/useAppTheme";
import { session } from "@/shared/session/session";
import { useProfile } from "../composables/useProfile";

/**
 * The hub names the groups and leads to them: a row is a page, never a toggle hidden among
 * settings - the Android settings shape, and the one Framework7's list is built for.
 */
const { t } = useI18n();
const appTheme = useAppTheme();
const theme = computed(() => appTheme.value);
const { profile, signingOut, signOut } = useProfile();

const account = computed(() => profile.value?.account ?? null);
const organizations = computed(() => profile.value?.organizations ?? []);
const host = computed(() => session.value?.endpoint.replace(/^https?:\/\//, "") ?? "—");
const version = __APP_VERSION__;

const notifySummary = computed(() => {
  const apps = profile.value?.apps ?? [];
  const on = apps.filter((app) => app.notify).length;
  return apps.length ? t("profile.notifyCount", { on, total: apps.length }) : "";
});

function confirmSignOut(): void {
  if (signingOut.value) return;
  f7.dialog
    .create({
      title: t("profile.signOutTitle"),
      text: t("profile.signOutText"),
      buttons: [
        { text: t("common.cancel") },
        {
          text: t("profile.signOut"),
          strong: true,
          cssClass: "dialog-button-danger",
          onClick: () => void signOut(),
        },
      ],
    })
    .open();
}
</script>
