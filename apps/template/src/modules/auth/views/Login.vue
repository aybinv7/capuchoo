<template>
  <f7-page name="login" no-toolbar no-navbar no-swipeback>
    <div class="absolute top-0 h-screen w-screen flex flex-col items-center justify-center">
      <!-- 🔹 Shader background -->
      <ShaderLines class="absolute h-screen w-screen z-0" />

      <!-- Optional overlay for readability -->
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm z-10"></div>

      <!-- 🔹 Content Container -->
      <div class="absolute z-20 flex flex-col items-center justify-center w-full px-4">
        <!-- Logo & Header -->
        <div class="flex flex-col items-center justify-center mb-8 w-full">
          <img
            src="/icons/icon.png"
            alt="Capucho"
            class="w-24 h-24 object-contain shadow-2xl rounded-2xl mb-4"
          />
          <h1 class="text-3xl text-white font-bold tracking-tight">Capucho App</h1>
          <p class="mt-1 text-white/60">Tester Platform</p>
        </div>

        <!-- Login Card -->
        <div
          class="w-full max-w-sm bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl"
        >
          <f7-list form no-hairlines-md class="no-margin-top no-margin-bottom transparent-list">
            <f7-list-input
              label="Email"
              type="email"
              placeholder="Your email"
              :value="email"
              @input="email = $event.target.value"
              required
              validate
              class="list-input-white"
            >
              <template #media>
                <i-lucide-mail class="" />
              </template>
            </f7-list-input>
            <f7-list-input
              label="Password"
              type="password"
              placeholder="Your password"
              :value="password"
              @input="password = $event.target.value"
              required
              validate
              class="list-input-white"
            >
              <template #media>
                <i-lucide-lock class="" />
              </template>
            </f7-list-input>
          </f7-list>

          <div class="mt-6 flex flex-col gap-3">
            <f7-button
              fill
              large
              class="bg-primary hover:bg-primary-light transition-all rounded-xl font-bold"
              preloader
              :loading="authStore.loading"
              @click="signIn"
            >
              Sign In
            </f7-button>

            <div class="text-center mt-2">
              <f7-link href="/auth/register" class="/80 text-sm hover: transition-colors">
                Don't have an account?
                <span class="text-primary font-bold ml-1">Sign up</span>
              </f7-link>
            </div>
          </div>
        </div>

        <!-- Footer Info -->
        <p class="mt-12 text-center text-xs px-8 text-white/60">
          By continuing, you agree to our
          <span class="underline">Terms</span> and <span class="underline">Privacy Policy</span>.
        </p>
      </div>
    </div>
  </f7-page>
</template>

<script setup lang="ts">
import ShaderLines from "@/shared/components/shaders/ShaderLines.vue";
import { useAuthStore } from "@/shared/stores/auth.store";
import { f7 } from "framework7-vue";
import { ref } from "vue";

const email = ref("");
const password = ref("");
const authStore = useAuthStore();

const signIn = async () => {
  if (!email.value || !password.value) {
    f7.dialog.alert("Please fill in all fields", "Error");
    return;
  }

  try {
    await authStore.login({ email: email.value, password: password.value });
    f7.views.main.router.navigate("/", { reloadAll: true });
    f7.toast
      .create({
        text: "Welcome back!",
        position: "bottom",
        closeTimeout: 2000,
      })
      .open();
  } catch (error: any) {
    f7.dialog.alert(error.message || "Login failed", "Error");
  }
};
</script>

<style scoped></style>
