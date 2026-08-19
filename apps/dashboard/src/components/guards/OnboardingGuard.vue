<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import { useOnboardingCheck } from '@/composables/useOnboardingCheck'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const { needsOnboarding, isCheckingOnboarding } = useOnboardingCheck()
const { isAuthenticated } = storeToRefs(authStore)

watch(
  [isAuthenticated, needsOnboarding, isCheckingOnboarding],
  ([authenticated, needs, checking]) => {
    if (!authenticated) return
    if (checking) return
    if (needs === null) return

    if (needs && !route.path.startsWith('/onboarding')) {
      router.replace('/onboarding')
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="isAuthenticated && isCheckingOnboarding"
    class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
  >
    <div class="flex flex-col items-center gap-4">
      <Loader2 class="h-8 w-8 animate-spin text-primary" />
      <p class="text-sm text-muted-foreground">Loading your workspace...</p>
    </div>
  </div>

  <slot v-else />
</template>
