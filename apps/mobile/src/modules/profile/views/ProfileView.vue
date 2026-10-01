<template>
  <F7Page class="cap-page">
    <F7Navbar large :title="t('profile.title')" class="navbar-gradient">
      <F7NavRight><LiveIndicator /></F7NavRight>
    </F7Navbar>

    <div class="flex flex-col gap-6 px-4 pt-1">
      <header v-if="profile?.account" class="account">
        <AppIcon :name="profile.account.full_name || profile.account.email" :bundle-id="profile.account.email" shape="clover4" :size="64" />
        <div class="min-w-0">
          <p class="truncate text-xl font-semibold">{{ profile.account.full_name || profile.account.email }}</p>
          <p class="truncate text-sm text-muted-foreground">{{ profile.account.email }}</p>
          <span v-if="profile.account.instance_admin" class="mt-1 inline-flex rounded-sm bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground uppercase">
            {{ t("profile.instanceAdmin") }}
          </span>
        </div>
      </header>

      <section class="flex flex-col gap-2">
        <h2 class="section-title">{{ t("profile.appearance") }}</h2>
        <F7Segmented strong class="m-0!">
          <F7Button v-for="mode in MODES" :key="mode.id" :active="theme.mode === mode.id" @click="theme.setMode(mode.id)">
            <F7Icon :md="`material:${mode.icon}`" size="18" class="me-1" />{{ t(`profile.mode.${mode.id}`) }}
          </F7Button>
        </F7Segmented>
      </section>

      <section v-if="profile?.organizations.length" class="flex flex-col gap-2">
        <h2 class="section-title">{{ t("profile.organizations") }}</h2>
        <F7List strong inset dividers class="m-0!">
          <F7ListItem v-for="org in profile.organizations" :key="org.id" :title="org.name" :after="t(`profile.orgRole.${org.role}`)" />
        </F7List>
      </section>

      <section v-if="profile?.apps.length" class="flex flex-col gap-2">
        <h2 class="section-title">{{ t("profile.notifications") }}</h2>
        <F7List strong inset dividers media-list class="m-0!">
          <F7ListItem v-for="app in profile.apps" :key="app.id" :title="app.name" :subtitle="t(`roles.name.${app.role}`)">
            <template #media>
              <AppIcon :name="app.name" :bundle-id="app.bundle_id" :icon-url="app.icon_url" :size="40" />
            </template>
            <template #after>
              <F7Toggle :checked="Boolean(app.notify)" @toggle:change="(on: boolean) => setNotify(app.id, on)" />
            </template>
          </F7ListItem>
        </F7List>
        <p class="px-1 text-xs text-muted-foreground">{{ t("profile.notificationsHint") }}</p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="section-title">{{ t("profile.server") }}</h2>
        <F7List strong inset dividers class="m-0!">
          <F7ListItem :title="t('profile.endpoint')" :after="endpoint" />
          <F7ListItem :title="t('profile.version')" :after="version" />
        </F7List>
      </section>

      <F7Button large round tonal class="sign-out h-14! font-semibold!" :disabled="signingOut" @click="confirmSignOut">
        <F7Icon md="material:logout" size="20" class="me-2" />{{ t("profile.signOut") }}
      </F7Button>
    </div>
  </F7Page>
</template>

<script setup lang="ts">
import AppIcon from "@/shared/components/app/AppIcon.vue";
import LiveIndicator from "@/shared/components/app/LiveIndicator.vue";
import { useAppTheme, type ColorMode } from "@/shared/composables/theme/useAppTheme";
import { session } from "@/shared/session/session";
import { useProfile } from "../composables/useProfile";

const MODES: Array<{ id: ColorMode; icon: string }> = [
  { id: "system", icon: "brightness_auto" },
  { id: "light", icon: "light_mode" },
  { id: "dark", icon: "dark_mode" },
];

const { t } = useI18n();
const theme = useAppTheme();
const { profile, signingOut, signOut, setNotify } = useProfile();

const endpoint = computed(() => session.value?.endpoint.replace(/^https?:\/\//, "") ?? "—");
const version = __APP_VERSION__;

function confirmSignOut(): void {
  f7.dialog
    .create({
      title: t("profile.signOutTitle"),
      text: t("profile.signOutText"),
      buttons: [
        { text: t("common.cancel") },
        { text: t("profile.signOut"), strong: true, cssClass: "dialog-button-danger", onClick: () => void signOut() },
      ],
    })
    .open();
}
</script>

<style scoped>
.account {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: var(--radius-xl-increased);
  background: var(--secondary);
  color: var(--secondary-foreground);
}

.section-title {
  margin: 0;
  padding-inline: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--muted-foreground);
}

.sign-out {
  --f7-button-text-color: var(--destructive-container-foreground);
  background: var(--destructive-container) !important;
}
</style>
