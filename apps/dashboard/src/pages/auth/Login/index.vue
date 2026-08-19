<template>
  <div
    class="relative flex h-screen flex-col items-center justify-center overflow-hidden lg:grid lg:max-w-none lg:grid-cols-2 lg:px-0"
  >
    <!-- 🔹 Shader background for all screens -->
    <ShaderLines class="absolute inset-0 z-0" />

    <!-- 🔹 Left content (only visible on large screens) -->
    <div class="relative hidden h-full flex-col text-white dark:border-r lg:flex z-10 p-10">
      <div class="relative z-20 flex items-center text-2xl font-semibold">
        <img :src="capgoLogo" class="aspect-square size-10 mr-2" alt="capgo Logo" />
        capgo Inc
      </div>

      <div class="relative z-20 mt-auto">
        <blockquote class="space-y-2">
          <p class="text-lg leading-relaxed max-w-md">
            &ldquo;Chat with your customers on Telegram and Meta, take orders automatically, get
            real-time alerts, and watch your conversion rate climb thanks to instant replies and
            smart product guidance.&rdquo;
          </p>
        </blockquote>
      </div>

      <!-- Optional overlay for readability -->
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
    </div>

    <!-- 🔹 Right content (login form) -->
    <div class="relative z-10 p-4 lg:p-8 flex flex-col justify-center items-center w-full">
      <div class="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <LoginForm class="w-full max-w-md">
          <template #form-content>
            <form @submit.prevent="login">
              <div class="grid gap-6">
                <div class="grid gap-3">
                  <div class="grid gap-3">
                    <Label for="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autocomplete="email"
                      v-model="email"
                      required
                      placeholder="m@example.com"
                    />
                  </div>

                  <div class="grid gap-3">
                    <div class="flex items-center justify-between">
                      <Label for="password">Password</Label>
                      <a href="#" class="text-sm underline-offset-4 hover:underline">
                        Forgot your password?
                      </a>
                    </div>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autocomplete="current-password"
                      v-model="password"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" :disabled="loading">
                  {{ loading ? 'Loading...' : 'Login' }}
                </Button>
              </div>
            </form>
          </template>

          <template #register-link>
            <div class="text-center text-sm">
              Don’t have an account?
              <RouterLink
                to="/auth/Register"
                class="underline underline-offset-4 hover:text-indigo-500"
              >
                Sign up
              </RouterLink>
            </div>
          </template>
        </LoginForm>

        <p class="px-8 text-center text-sm text-muted-foreground">
          By clicking continue, you agree to our
          <a href="/terms" class="underline underline-offset-4 hover:text-primary">
            Terms of Service
          </a>
          and
          <a href="/privacy" class="underline underline-offset-4 hover:text-primary">
            Privacy Policy </a
          >.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import capgoLogo from '@/assets/images/capucho.png'
import { toast } from 'vue-sonner'

const email = ref('')
const password = ref('')
const loading = ref(false)

const router = useRouter()
const authStore = useAuthStore()

const login = async () => {
  if (!email.value || !password.value) {
    toast.error('Please fill all the fields')
    return
  }

  loading.value = true
  try {
    await authStore.login({ email: email.value, password: password.value })
    toast.success('Logged in successfully')
    router.push('/dashboard')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'There was an error, please try again'
    toast.error(message)
  } finally {
    loading.value = false
  }
}

definePage({
  meta: {
    title: 'Login',
    description: 'Log in to your capgo account',
    category: 'authentication',
    hideFromSearch: true,
    requiresAuth: false,
    layout: 'empty',
  },
})
</script>
