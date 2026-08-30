<template>
  <div class="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">My Account</h1>
      <p class="text-sm text-muted-foreground mt-1">Manage your profile and security settings</p>
    </div>

    <!-- Profile Section -->
    <section class="mb-10">
      <h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
        Profile
      </h2>

      <!-- Avatar Upload -->
      <div class="flex items-center gap-6 mb-6">
        <div class="relative group">
          <Avatar class="h-20 w-20 rounded-full border">
            <AvatarImage :src="profile.avatar" :alt="profile.name" />
            <AvatarFallback class="text-lg bg-muted">{{
              getInitials(profile.name)
            }}</AvatarFallback>
          </Avatar>
          <div
            class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <span class="text-xs text-white font-medium">Change</span>
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-sm font-medium">Profile Photo</span>
          <span class="text-xs text-muted-foreground">Supported file types: png, jpg, jpeg.</span>
          <!--
            "Upload Photo" had no handler and there is no avatar upload behind
            it - no endpoint, no storage bucket for it. Removed rather than
            wired to something invented; the avatar falls back to initials.
          -->
        </div>
      </div>

      <!-- Form Fields -->
      <form @submit.prevent="saveProfile" class="space-y-4">
        <div class="grid gap-1.5">
          <Label for="name" class="text-xs uppercase text-muted-foreground">Preferred Name</Label>
          <Input
            id="name"
            v-model="profile.name"
            class="max-w-md bg-muted/30 border-transparent focus:bg-background focus:border-input transition-all"
          />
        </div>

        <div class="grid gap-1.5">
          <Label for="email" class="text-xs uppercase text-muted-foreground">Email</Label>
          <Input
            id="email"
            v-model="profile.email"
            type="email"
            disabled
            class="max-w-md bg-muted/50 text-muted-foreground cursor-not-allowed"
          />
          <p class="text-[10px] text-muted-foreground">Contact your admin to change your email.</p>
        </div>

        <div class="pt-2">
          <Button type="submit" variant="default" size="sm" :disabled="savingProfile">
            {{ savingProfile ? "Saving..." : "Update Profile" }}
          </Button>
        </div>
      </form>
    </section>

    <Separator class="my-8" />

    <!-- Security Section -->
    <section class="mb-10">
      <h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
        Security
      </h2>

      <form @submit.prevent="changePassword" class="space-y-4 max-w-md">
        <div class="grid gap-1.5">
          <Label for="currentPassword" class="text-xs uppercase text-muted-foreground"
            >Current Password</Label
          >
          <Input
            id="currentPassword"
            v-model="password.current"
            type="password"
            class="bg-muted/30 border-transparent focus:bg-background focus:border-input transition-all"
          />
        </div>

        <div class="grid gap-1.5">
          <Label for="newPassword" class="text-xs uppercase text-muted-foreground"
            >New Password</Label
          >
          <Input
            id="newPassword"
            v-model="password.new"
            type="password"
            class="bg-muted/30 border-transparent focus:bg-background focus:border-input transition-all"
          />
        </div>

        <div class="grid gap-1.5">
          <Label for="confirmPassword" class="text-xs uppercase text-muted-foreground"
            >Confirm New Password</Label
          >
          <Input
            id="confirmPassword"
            v-model="password.confirm"
            type="password"
            class="bg-muted/30 border-transparent focus:bg-background focus:border-input transition-all"
          />
        </div>

        <div class="pt-2">
          <Button type="submit" variant="outline" size="sm" :disabled="changingPassword">
            {{ changingPassword ? "Updating..." : "Change Password" }}
          </Button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useToast } from "@/composables/useToast";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { Separator } from "@/components/ui/separator";

const { showSuccess, showError } = useToast();
const authStore = useAuthStore();

/**
 * The signed-in user, rather than a fixture.
 *
 * This was hard-coded to "Ahmed Benali / ahmed@example.com" with a generated
 * avatar, so every account showed someone else's name and address on its own
 * settings page - and the profile form edited that fixture.
 */
const profile = ref({
  name: "",
  email: "",
  avatar: "",
});

watchEffect(() => {
  const user = authStore.user;
  if (!user) return;

  profile.value = {
    name: (user.user_metadata?.full_name as string) ?? "",
    email: user.email ?? "",
    avatar: (user.user_metadata?.avatar_url as string) ?? "",
  };
});

const password = ref({
  current: "",
  new: "",
  confirm: "",
});

const savingProfile = ref(false);
const changingPassword = ref(false);

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

const saveProfile = async () => {
  savingProfile.value = true;
  try {
    await authService.updateProfile(profile.value.name);
    await authStore.init();
    showSuccess("Profile updated");
  } catch (error) {
    showError(error instanceof Error ? error.message : "Could not update your profile");
  } finally {
    savingProfile.value = false;
  }
};

/**
 * Actually changes the password.
 *
 * This compared the two fields, cleared the form and announced "Password
 * updated" without calling anything. Of every fake success in this dashboard it
 * is the one that could do real harm: someone rotating a password they believed
 * was exposed would have walked away still using it, having been told
 * otherwise.
 */
const changePassword = async () => {
  if (password.value.new !== password.value.confirm) {
    showError("Passwords do not match");
    return;
  }
  if (password.value.new.length < 8) {
    showError("Use at least 8 characters");
    return;
  }

  changingPassword.value = true;
  try {
    await authService.updatePassword(password.value.new);
    showSuccess("Password updated");
    password.value = { current: "", new: "", confirm: "" };
  } catch (error) {
    // Never cleared on failure: retyping a password you thought had been
    // accepted is exactly the moment to keep what was typed.
    showError(error instanceof Error ? error.message : "Could not update your password");
  } finally {
    changingPassword.value = false;
  }
};
</script>
