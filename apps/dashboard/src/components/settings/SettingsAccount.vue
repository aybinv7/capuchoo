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
          <Button variant="outline" size="sm" class="mt-2 w-fit">Upload Photo</Button>
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
          <Button type="submit" variant="default" size="sm">Update Profile</Button>
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
          <Button type="submit" variant="outline" size="sm">Change Password</Button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import { Separator } from '@/components/ui/separator'

const { showSuccess, showError } = useToast()

const profile = ref({
  name: 'Ahmed Benali',
  email: 'ahmed@example.com',
  avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Ahmed+Benali',
})

const password = ref({
  current: '',
  new: '',
  confirm: '',
})

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)

const saveProfile = () => {
  showSuccess('Profile updated')
}

const changePassword = () => {
  if (password.value.new !== password.value.confirm) {
    showError('Passwords do not match')
    return
  }
  showSuccess('Password updated')
  password.value = { current: '', new: '', confirm: '' }
}
</script>
