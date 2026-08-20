<template>
  <f7-page
    name="register"
    no-toolbar
    no-navbar
    no-swipeback
    login-screen
    class="login-screen-transparent"
  >
    <div class="relative flex h-full flex-col items-center justify-center overflow-hidden">
      <!-- 🔹 Shader background -->
      <ShaderLines class="absolute inset-0 z-0" />

      <!-- Optional overlay for readability -->
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm z-10"></div>

      <!-- 🔹 Content Container -->
      <div
        class="relative z-20 flex flex-col items-center justify-center w-full px-4 safe-area-padding"
      >
        <!-- Header -->
        <div class="flex flex-col items-center justify-center mb-8 w-full text-white">
          <h1 class="text-3xl font-bold tracking-tight">Create Account</h1>
          <p class="text-gray-300 mt-1 opacity-80">Join the Capucho Tester Program</p>
        </div>

        <!-- Register Card -->
        <div
          class="w-full max-w-sm bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl"
        >
          <f7-list
            form
            no-hairlines-md
            class="no-margin-top no-margin-bottom transparent-list text-white"
          >
            <f7-list-input
              label="Full Name"
              type="text"
              placeholder="Your name"
              class="list-input-white"
            >
              <template #media>
                <i-lucide-user class="text-white/60" />
              </template>
            </f7-list-input>
            <f7-list-input
              label="Email"
              type="email"
              placeholder="Your email"
              class="list-input-white"
            >
              <template #media>
                <i-lucide-mail class="text-white/60" />
              </template>
            </f7-list-input>
            <f7-list-input
              label="Password"
              type="password"
              placeholder="Minimum 8 characters"
              class="list-input-white"
            >
              <template #media>
                <i-lucide-lock class="text-white/60" />
              </template>
            </f7-list-input>
          </f7-list>

          <div class="mt-6 flex flex-col gap-3">
            <f7-button
              fill
              large
              class="bg-primary hover:bg-primary-light transition-all rounded-xl font-bold opacity-50"
              disabled
            >
              Sign Up
            </f7-button>

            <div class="text-center mt-2">
              <f7-link
                href="/auth/login"
                class="text-white/80 text-sm hover:text-white transition-colors"
              >
                Already have an account?
                <span class="text-primary font-bold ml-1">Sign in</span>
              </f7-link>
            </div>
          </div>

          <div
            class="mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-xl flex items-start gap-2"
          >
            <!-- <i-lucide-info class="text-blue-400 size-5 shrink-0 mt-0.5" /> -->
            <p class="text-xs text-blue-200 leading-snug">
              Registration is currently in closed beta. Please contact an admin for an invitation.
            </p>
          </div>
        </div>
      </div>
    </div>
  </f7-page>
</template>

<script setup lang="ts">
// Registration logic to be implemented
</script>
