<template>
  <div
    class="relative flex h-screen flex-col items-center justify-center overflow-hidden lg:grid lg:max-w-none lg:grid-cols-2 lg:px-0"
  >
    <!-- 🔹 Shader background for all screens -->
    <ShaderAnimation class="absolute inset-0 z-0" />

    <!-- 🔹 Left content (only visible on large screens) -->
    <div class="relative hidden h-full flex-col text-white dark:border-r lg:flex z-10 p-10">
      <div class="relative z-20 flex items-center text-2xl font-semibold">
        <img src="/assets/capucho.png" class="aspect-square size-10 mr-2" alt="capgo Logo" />
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
    <div class="relative z-10 p-4 lg:p-8 flex flex-col justify-center items-center w-full">
      <div class="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div class="flex flex-col space-y-2 text-center text-background">
          <h1 class="text-2xl font-semibold tracking-tight">Create an account</h1>
          <p class="text-sm">Enter your email below to create your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{{ step === 'register' ? 'Sign Up' : 'Verify Email' }}</CardTitle>
            <CardDescription>
              {{
                step === 'register'
                  ? 'Start managing your apps today.'
                  : `Enter the 6-digit code sent to ${form.email}`
              }}
            </CardDescription>
          </CardHeader>

          <!-- Step 1: Registration Form -->
          <CardContent v-if="step === 'register'" class="grid gap-4">
            <div class="grid gap-2">
              <Label for="email">Email</Label>
              <Input id="email" v-model="form.email" type="email" placeholder="m@example.com" />
            </div>
            <div class="grid gap-2">
              <Label for="businessName">Full Name</Label>
              <Input
                id="businessName"
                v-model="form.businessName"
                type="text"
                placeholder="John Doe"
              />
            </div>
            <div class="grid gap-2">
              <Label for="password">Password</Label>
              <Input id="password" v-model="form.password" type="password" />
            </div>
          </CardContent>

          <!-- Step 2: OTP Verification -->
          <CardContent v-else-if="step === 'verify'" class="flex flex-col items-center gap-6 py-6">
            <div class="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail class="h-8 w-8 text-primary" />
            </div>

            <div class="text-center space-y-2">
              <p class="text-sm text-muted-foreground">We sent a verification code to</p>
              <p class="font-medium">{{ form.email }}</p>
            </div>

            <InputOTP
              v-model="otpCode"
              :maxlength="6"
              :disabled="isVerifying"
              @complete="handleOtpComplete"
            >
              <InputOTPGroup>
                <InputOTPSlot :index="0" />
                <InputOTPSlot :index="1" />
                <InputOTPSlot :index="2" />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot :index="3" />
                <InputOTPSlot :index="4" />
                <InputOTPSlot :index="5" />
              </InputOTPGroup>
            </InputOTP>

            <div v-if="otpError" class="text-sm text-destructive text-center">
              {{ otpError }}
            </div>

            <div class="text-center text-sm text-muted-foreground">
              <span>Didn't receive a code?</span>
              <Button
                variant="link"
                class="px-1 h-auto"
                :disabled="resendCooldown > 0"
                @click="handleResendCode"
              >
                {{ resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code' }}
              </Button>
            </div>
          </CardContent>

          <!-- Step 1 Footer -->
          <CardFooter v-if="step === 'register'" class="flex flex-col gap-4">
            <Button class="w-full" :disabled="isLoading" @click="handleRegister">
              <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
              <span v-if="isLoading">Creating account...</span>
              <span v-else>Create account</span>
            </Button>
            <div class="text-center text-sm">
              Already have an account?
              <RouterLink to="/auth/login" class="underline underline-offset-4 hover:text-primary">
                Sign in
              </RouterLink>
            </div>
          </CardFooter>

          <!-- Step 2 Footer -->
          <CardFooter v-else-if="step === 'verify'" class="flex flex-col gap-4">
            <Button
              class="w-full"
              :disabled="isVerifying || otpCode.length < 6"
              @click="handleVerifyOtp"
            >
              <Loader2 v-if="isVerifying" class="mr-2 h-4 w-4 animate-spin" />
              <span v-if="isVerifying">Verifying...</span>
              <span v-else>Verify & Continue</span>
            </Button>
            <Button variant="ghost" class="w-full" @click="step = 'register'">
              <ArrowLeft class="mr-2 h-4 w-4" />
              Back to registration
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Mail, Loader2, ArrowLeft } from 'lucide-vue-next'
import { authService } from '@/services/auth.service'
import ShaderAnimation from '@/components/shaders/ShaderAnimation .vue'

const router = useRouter()
const authStore = useAuthStore()

type Step = 'register' | 'verify'

const step = ref<Step>('register')
const form = ref({
  email: '',
  password: '',
  businessName: '',
})

const isLoading = ref(false)
const isVerifying = ref(false)
const otpCode = ref('')
const otpError = ref('')
const resendCooldown = ref(0)

// Resend cooldown timer
let cooldownInterval: number | null = null

const startResendCooldown = () => {
  resendCooldown.value = 60
  cooldownInterval = window.setInterval(() => {
    resendCooldown.value--
    if (resendCooldown.value <= 0 && cooldownInterval) {
      clearInterval(cooldownInterval)
      cooldownInterval = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (cooldownInterval) {
    clearInterval(cooldownInterval)
  }
})

async function handleRegister() {
  if (!form.value.email || !form.value.password || !form.value.businessName) {
    toast.error('Please fill in all fields')
    return
  }

  try {
    isLoading.value = true
    await authStore.register({
      email: form.value.email,
      password: form.value.password,
      businessName: form.value.businessName,
    })

    toast.success('Verification code sent! Please check your email.')
    step.value = 'verify'
    startResendCooldown()
  } catch (error: any) {
    console.error('Registration error:', error)

    // Check if user already exists
    const errorMessage = error.message?.toLowerCase() || ''
    if (
      errorMessage.includes('already registered') ||
      errorMessage.includes('already exists') ||
      errorMessage.includes('user already')
    ) {
      toast.error('This email is already registered. Please sign in instead.', {
        action: {
          label: 'Sign In',
          onClick: () => router.push('/auth/login'),
        },
      })
    } else {
      toast.error(error.message || 'Registration failed')
    }
  } finally {
    isLoading.value = false
  }
}

async function handleOtpComplete(code: string) {
  otpCode.value = code
  await handleVerifyOtp()
}

async function handleVerifyOtp() {
  if (otpCode.value.length < 6) {
    otpError.value = 'Please enter the complete 6-digit code'
    return
  }

  try {
    isVerifying.value = true
    otpError.value = ''

    const { session } = await authService.verifyOtp(form.value.email, otpCode.value, 'signup')

    if (session) {
      toast.success('Email verified successfully!')
      // Reinitialize auth store with new session
      await authStore.init()
      // Redirect to onboarding
      router.push('/onboarding')
    } else {
      otpError.value = 'Verification failed. Please try again.'
    }
  } catch (error: any) {
    console.error('OTP verification error:', error)
    otpError.value = error.message || 'Invalid code. Please try again.'
    otpCode.value = ''
  } finally {
    isVerifying.value = false
  }
}

async function handleResendCode() {
  try {
    await authService.resendOtp(form.value.email)
    toast.success('New verification code sent!')
    startResendCooldown()
    otpCode.value = ''
    otpError.value = ''
  } catch (error: any) {
    toast.error(error.message || 'Failed to resend code')
  }
}

definePage({
  meta: {
    title: 'Register',
    description: 'Register to your capgo account',
    category: 'authentication',
    hideFromSearch: true,
    requiresAuth: false,
    layout: 'empty',
  },
})
</script>
