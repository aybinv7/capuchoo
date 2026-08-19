<script setup lang="ts">
const features = [
  {
    id: 'instant',
    title: 'Instant Updates',
    headline: 'Push updates in seconds, not days',
    description:
      "Skip the app store review process entirely. Deploy fixes, features, and improvements directly to your users the moment they're ready. No more waiting for approval.",
    stats: [
      { value: '~1s', label: 'Delivery time' },
      { value: '99.9%', label: 'Success rate' },
      { value: '0', label: 'Store delays' },
    ],
    gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
    accent: 'bg-amber-500',
  },
  {
    id: 'multiplatform',
    title: 'Multi-Platform',
    headline: 'One codebase, all platforms',
    description:
      'Support iOS and Android with a single integration. Works seamlessly with Capacitor, Cordova, and other hybrid frameworks. Write once, deploy everywhere.',
    stats: [
      { value: 'iOS', label: 'Full support' },
      { value: 'Android', label: 'Full support' },
      { value: '5min', label: 'Setup time' },
    ],
    gradient: 'from-blue-500/20 via-cyan-500/10 to-transparent',
    accent: 'bg-blue-500',
  },
  {
    id: 'rollback',
    title: 'Instant Rollback',
    headline: 'Undo mistakes with one click',
    description:
      'Something went wrong? Roll back to any previous version instantly. Your users will never notice. Keep full version history and restore confidence.',
    stats: [
      { value: '∞', label: 'Version history' },
      { value: '1-click', label: 'Rollback' },
      { value: '100%', label: 'Data safe' },
    ],
    gradient: 'from-green-500/20 via-emerald-500/10 to-transparent',
    accent: 'bg-green-500',
  },
  {
    id: 'analytics',
    title: 'Real-time Analytics',
    headline: 'Know everything, instantly',
    description:
      'Track update adoption rates, device metrics, and success rates in real-time. Identify issues before they become problems. Data-driven decisions made easy.',
    stats: [
      { value: 'Live', label: 'Monitoring' },
      { value: '50+', label: 'Metrics' },
      { value: '24/7', label: 'Insights' },
    ],
    gradient: 'from-purple-500/20 via-violet-500/10 to-transparent',
    accent: 'bg-purple-500',
  },
]

const activeIndex = ref(0)
const isPaused = ref(false)
let intervalId: number | undefined

const activeFeature = computed(() => features[activeIndex.value])

const progress = ref(0)
const INTERVAL_DURATION = 5000 // 5 seconds per feature
const PROGRESS_UPDATE_INTERVAL = 50 // Update progress every 50ms

const startAutoRotate = () => {
  let elapsed = 0
  intervalId = window.setInterval(() => {
    if (isPaused.value) return

    elapsed += PROGRESS_UPDATE_INTERVAL
    progress.value = (elapsed / INTERVAL_DURATION) * 100

    if (elapsed >= INTERVAL_DURATION) {
      elapsed = 0
      progress.value = 0
      activeIndex.value = (activeIndex.value + 1) % features.length
    }
  }, PROGRESS_UPDATE_INTERVAL)
}

const selectFeature = (index: number) => {
  activeIndex.value = index
  progress.value = 0
}

onMounted(() => {
  startAutoRotate()
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<template>
  <section id="features" class="py-24 lg:py-32 overflow-hidden">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <!-- Section Header -->
      <div class="text-center max-w-3xl mx-auto mb-16">
        <Badge variant="secondary" class="mb-4">Features</Badge>
        <h2 class="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Built for modern
          <span class="text-primary">mobile development</span>
        </h2>
      </div>

      <!-- Feature Tabs -->
      <div
        class="flex flex-wrap justify-center gap-2 mb-12"
        @mouseenter="isPaused = true"
        @mouseleave="isPaused = false"
      >
        <button
          v-for="(feature, index) in features"
          :key="feature.id"
          @click="selectFeature(index)"
          class="group relative px-6 py-3 rounded-full transition-all duration-300"
          :class="[
            activeIndex === index
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground',
          ]"
        >
          <span class="relative z-10 text-sm font-medium">{{ feature.title }}</span>

          <!-- Progress indicator for active tab -->
          <div v-if="activeIndex === index" class="absolute inset-0 rounded-full overflow-hidden">
            <div
              class="absolute inset-0 bg-primary-foreground/20 origin-left transition-transform"
              :style="{ transform: `scaleX(${progress / 100})` }"
            />
          </div>
        </button>
      </div>

      <!-- Feature Content Card -->
      <div class="relative" @mouseenter="isPaused = true" @mouseleave="isPaused = false">
        <!-- Background gradient -->
        <div
          :class="[
            'absolute inset-0 rounded-3xl transition-all duration-700',
            `bg-gradient-to-br ${activeFeature?.gradient}`,
          ]"
        />

        <!-- Main Card -->
        <div
          class="relative rounded-3xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden"
        >
          <div class="grid lg:grid-cols-2 gap-8 lg:gap-12 p-8 lg:p-12">
            <!-- Left: Content -->
            <div class="flex flex-col justify-center">
              <!-- Active indicator bar -->
              <div :class="['w-12 h-1 rounded-full mb-6', activeFeature?.accent]" />

              <h3 class="text-3xl lg:text-4xl font-bold mb-4 tracking-tight">
                {{ activeFeature?.headline }}
              </h3>

              <p class="text-lg text-muted-foreground leading-relaxed mb-8">
                {{ activeFeature?.description }}
              </p>

              <!-- Stats -->
              <div class="grid grid-cols-3 gap-6">
                <div
                  v-for="stat in activeFeature?.stats"
                  :key="stat.label"
                  class="text-center lg:text-left"
                >
                  <div class="text-2xl lg:text-3xl font-bold text-foreground">
                    {{ stat.value }}
                  </div>
                  <div class="text-sm text-muted-foreground">
                    {{ stat.label }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Right: Visual/Mockup Area -->
            <div class="relative flex items-center justify-center min-h-[300px] lg:min-h-[400px]">
              <!-- Abstract visual based on feature -->
              <div class="relative w-full h-full flex items-center justify-center">
                <!-- Floating elements for visual interest -->
                <div
                  class="absolute w-64 h-64 rounded-3xl border border-border bg-card shadow-2xl transform rotate-3 transition-transform duration-500 hover:rotate-0"
                >
                  <div class="p-6 h-full flex flex-col">
                    <div class="flex items-center gap-2 mb-4">
                      <div :class="['w-3 h-3 rounded-full', activeFeature?.accent]" />
                      <div class="h-3 w-20 bg-muted rounded" />
                    </div>
                    <div class="flex-1 space-y-3">
                      <div class="h-4 w-full bg-muted/50 rounded" />
                      <div class="h-4 w-3/4 bg-muted/30 rounded" />
                      <div class="h-4 w-1/2 bg-muted/20 rounded" />
                    </div>
                    <div class="flex gap-2 mt-4">
                      <div :class="activeFeature?.accent" class="h-8 w-20 rounded-lg opacity-80" />
                      <div class="h-8 w-16 rounded-lg bg-muted" />
                    </div>
                  </div>
                </div>

                <div
                  class="absolute w-48 h-48 rounded-2xl border border-border bg-card shadow-xl transform -rotate-6 -translate-x-8 translate-y-8 transition-transform duration-500 hover:rotate-0"
                >
                  <div class="p-4 h-full flex flex-col justify-center items-center gap-3">
                    <div :class="activeFeature?.accent" class="w-12 h-12 rounded-xl opacity-60" />
                    <div class="h-3 w-24 bg-muted rounded" />
                    <div class="h-2 w-16 bg-muted/50 rounded" />
                  </div>
                </div>

                <!-- Decorative dots -->
                <div class="absolute top-4 right-4 grid grid-cols-3 gap-2">
                  <div v-for="i in 9" :key="i" class="w-2 h-2 rounded-full bg-muted/30" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Dots indicator (mobile) -->
        <div class="flex justify-center gap-2 mt-6 lg:hidden">
          <button
            v-for="(_, index) in features"
            :key="index"
            @click="selectFeature(index)"
            class="w-2 h-2 rounded-full transition-all"
            :class="activeIndex === index ? 'bg-primary w-6' : 'bg-muted'"
          />
        </div>
      </div>
    </div>
  </section>
</template>
