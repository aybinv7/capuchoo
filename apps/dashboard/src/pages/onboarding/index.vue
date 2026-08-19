<template>
  <div
    class="min-h-screen bg-background flex flex-col justify-center items-center w-full h-full px-4 sm:px-6 lg:px-8"
  >
    <!-- Top Bar / Brand -->
    <div class="mb-8 w-full max-w-2xl flex items-center justify-between">
      <div class="flex items-center gap-2 font-bold text-xl">
        <div class="bg-primary text-primary-foreground p-1 rounded">
          <ILucideCpu class="h-6 w-6" />
        </div>
        CapGO
      </div>
      <div class="text-sm text-muted-foreground">
        Step {{ currentStepIndex + 1 }} of {{ steps.length }}
      </div>
    </div>

    <!-- Stepper Progress -->
    <div class="w-full max-w-2xl mb-12">
      <div class="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          class="absolute left-0 top-0 h-full bg-primary transition-all duration-500 ease-in-out"
          :style="{ width: `${progressPercentage}%` }"
        ></div>
      </div>
      <div class="mt-4 flex justify-between text-xs font-medium text-muted-foreground">
        <span
          v-for="(step, index) in steps"
          :key="step.key"
          :class="{ 'text-primary': index <= currentStepIndex }"
          class="transition-colors duration-300 hidden sm:block"
        >
          {{ step.label }}
        </span>
      </div>
    </div>

    <!-- Main Card Content -->
    <div class="w-full max-w-xl">
      <Transition
        mode="out-in"
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <component :is="currentStep?.component.value" @next="nextStep" @back="prevStep" />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import OnboardingStepOrganization from '@/modules/onboarding/components/OnboardingStepOrganization.vue'
import OnboardingStepCreateApp from '@/modules/onboarding/components/OnboardingStepCreateApp.vue'
// Removed unused imports
import OnboardingStepInstructions from '@/modules/onboarding/components/OnboardingStepInstructions.vue'
import { useRouter } from 'vue-router'
import { computed, ref, shallowRef } from 'vue'

const router = useRouter()

const steps = [
  { key: 'organization', label: 'Organization', component: shallowRef(OnboardingStepOrganization) },
  { key: 'app', label: 'Create App', component: shallowRef(OnboardingStepCreateApp) },
  // { key: 'channels', label: 'Channels', component: shallowRef(OnboardingStepChannels) }, // Optional? Prompt didn't mention it explicitly but standard flow might need it. Keep it if it fits. User said "create his first org and app". Maybe skip channels/invite for now to keep it strict to request? But "Integration" usually needs channels. I'll keep them but might need to verify they work with new schema.
  { key: 'instructions', label: 'Integration', component: shallowRef(OnboardingStepInstructions) },
]

const currentStepIndex = ref(0)
const currentStep = computed(() => steps[currentStepIndex.value])
const progressPercentage = computed(() => {
  return ((currentStepIndex.value + 1) / steps.length) * 100
})

const nextStep = () => {
  if (currentStepIndex.value < steps.length - 1) {
    currentStepIndex.value++
  } else {
    router.push('/dashboard')
  }
}

const prevStep = () => {
  if (currentStepIndex.value > 0) {
    currentStepIndex.value--
  } else {
    // If back from first step (Org), maybe logout or go back to register?
    router.push('/')
  }
}

definePage({
  meta: {
    layout: 'empty',
    requiresAuth: true,
  },
})
</script>
