<script setup lang="ts">
import { ref, computed } from 'vue'
import { Lock, RefreshCw, CheckCircle2, Zap, Download, PartyPopper } from 'lucide-vue-next'
import AnimatedUnderline from './AnimatedUnderline.vue'

// Animation States
type AnimationStage = 'idle' | 'deploying' | 'transferring' | 'downloading' | 'updated'

const stage = ref<AnimationStage>('idle')
const progress = ref(0)
const downloadProgress = ref(0)

const startRelease = () => {
  if (stage.value !== 'idle' && stage.value !== 'updated') return

  // Reset
  stage.value = 'deploying'
  progress.value = 0
  downloadProgress.value = 0

  // 1. Dashboard Deployment Progress
  const deployInterval = setInterval(() => {
    progress.value += 2
    if (progress.value >= 100) {
      clearInterval(deployInterval)
      startTransfer()
    }
  }, 20)
}

const startTransfer = () => {
  stage.value = 'transferring'
  // 2. Asset Transfer (Wire Animation) happens via CSS transition duration
  setTimeout(() => {
    startDownload()
  }, 3000) // Match wire animation duration
}

const startDownload = () => {
  stage.value = 'downloading'
  // 3. Phone Download Progress
  const downloadInterval = setInterval(() => {
    downloadProgress.value += 1.5
    if (downloadProgress.value >= 100) {
      clearInterval(downloadInterval)
      stage.value = 'updated'
    }
  }, 30) // slightly slower for dramatic effect
}

const resetDemo = () => {
  stage.value = 'idle'
  progress.value = 0
  downloadProgress.value = 0
}

// Visual Helpers
const isDeploying = computed(() => stage.value === 'deploying')
const isTransferring = computed(() => stage.value === 'transferring')
const isDownloading = computed(() => stage.value === 'downloading')
const isUpdated = computed(() => stage.value === 'updated')

const buttonText = computed(() => {
  switch (stage.value) {
    case 'idle':
      return 'Release v2.0.0'
    case 'deploying':
      return 'Building Bundle...'
    case 'transferring':
      return 'Pushing to Edge...'
    case 'downloading':
      return 'Device Updating...'
    case 'updated':
      return 'Deployed Successfully'
    default:
      return 'Release v2.0.0'
  }
})
</script>

<template>
  <section class="py-24 px-4 overflow-hidden select-none">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16">
        <div
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900/50 text-stone-100 w-fit mx-auto mb-4"
        >
          <span class="text-sm font-semibold">Dashboard</span>
        </div>
        <h2 class="text-3xl font-bold">
          Full control over your
          <span class="noto-serif-display-300 font-thin italic relative">
            deployments
            <span class="absolute -bottom-2 left-0 right-0 z-0">
              <AnimatedUnderline />
            </span>
          </span>
        </h2>
      </div>

      <div
        class="flex flex-col lg:flex-row justify-between items-center gap-8 relative w-full h-[600px]"
      >
        <!-- Connection Wire (Absolute SVG) -->
        <!-- Visible only on desktop to avoid layout mess on mobile -->
        <svg
          class="hidden z-0 lg:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[200px] pointer-events-none"
          viewBox="0 0 800 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.2" />
              <stop offset="50%" stop-color="#3b82f6" stop-opacity="0.5" />
              <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.2" />
            </linearGradient>
            <filter id="glow-point">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <!-- Base Path (Removed to look wireless) -->
          <!-- The path definition is still needed for animateMotion to reference, but we don't render the stroke -->

          <!-- Moving Glow Point -->
          <circle r="8" fill="#f97316" filter="url(#glow-point)" class="opacity-0">
            <animateMotion
              v-if="isTransferring || isDownloading"
              dur="3s"
              repeatCount="indefinite"
              path="M 100 100 C 300 100, 500 100, 700 100"
            />
            <animate
              v-if="isTransferring || isDownloading"
              attributeName="opacity"
              values="0;1;1;0"
              dur="3s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>

        <!-- LEFT: Dashboard -->
        <div
          class="relative w-full lg:w-3/5 h-full z-20 transition-all duration-500 flex flex-col"
          :class="{ 'scale-95 blur-[1px]': isDownloading }"
        >
          <div
            class="bg-stone-900 h-full border border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-shadow duration-500 relative"
            :class="{
              'shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] border-blue-500/30':
                isDeploying || isTransferring,
            }"
          >
            <!-- Glow Edge -->
            <div
              class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-stone-500 to-transparent opacity-50 z-50"
            />

            <!-- Browser Header -->
            <div
              class="h-12 border-b border-stone-800 bg-stone-900/50 flex items-center px-4 gap-4"
            >
              <div class="flex gap-2">
                <div class="w-3 h-3 rounded-full bg-red-500/20" />
                <div class="w-3 h-3 rounded-full bg-yellow-500/20" />
                <div class="w-3 h-3 rounded-full bg-green-500/20" />
              </div>
              <div
                class="flex-1 max-w-md bg-stone-800/50 rounded-md h-8 flex items-center px-3 gap-2"
              >
                <Lock class="w-3 h-3 text-stone-500" />
                <span class="text-xs text-stone-400">dashboard.capgo.app</span>
              </div>
            </div>

            <!-- Dashboard Content -->
            <div class="p-8 flex-1 flex flex-col relative">
              <div class="flex justify-between items-start mb-8">
                <div>
                  <h3 class="text-xl font-bold text-white">Production Deployment</h3>
                  <div class="flex items-center gap-2 mt-2">
                    <span
                      class="w-2 h-2 rounded-full"
                      :class="isUpdated ? 'bg-green-500' : 'bg-emerald-500 animate-pulse'"
                    />
                    <span class="text-sm text-stone-400"
                      >Live: v{{ isUpdated ? '2.0.0' : '1.9.9' }}</span
                    >
                  </div>
                </div>
                <button
                  @click="stage === 'updated' ? resetDemo() : startRelease()"
                  :disabled="stage !== 'idle' && stage !== 'updated'"
                  class="relative overflow-hidden group bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg font-medium text-sm transition-all active:scale-95 disabled:opacity-80 disabled:cursor-not-allowed"
                >
                  <span class="relative z-10 flex items-center gap-2">
                    <Zap v-if="stage === 'idle'" class="w-4 h-4 fill-current" />
                    <RefreshCw v-else-if="!isUpdated" class="w-4 h-4 animate-spin" />
                    <CheckCircle2 v-else class="w-4 h-4" />
                    {{ buttonText }}
                  </span>
                  <!-- Progress Fill -->
                  <div
                    v-if="isDeploying"
                    class="absolute inset-0 bg-white/20 transition-all duration-100 ease-linear"
                    :style="{ width: `${progress}%` }"
                  />
                </button>
              </div>

              <!-- Stats Grid -->
              <div class="grid grid-cols-2 gap-4 mb-8">
                <div
                  v-for="stat in ['Active Devices', 'Success Rate', 'Avg Time', 'Total Size']"
                  :key="stat"
                  class="bg-stone-800/30 border border-stone-800 rounded-xl p-4"
                >
                  <div class="text-xs text-stone-500 uppercase font-semibold mb-1">{{ stat }}</div>
                  <div class="h-6 w-24 bg-stone-800 rounded animate-pulse" />
                </div>
              </div>

              <!-- Deployment Logs / Terminal -->
              <div
                class="flex-1 bg-black/40 rounded-xl p-4 font-mono text-xs text-stone-400 overflow-hidden flex flex-col-reverse"
              >
                <div v-if="isUpdated" class="text-green-400">
                  > Deployment complete! v2.0.0 is live.
                </div>
                <div v-if="isDownloading || isUpdated" class="text-blue-400">
                  > Device 1892.23 successfully updated...
                </div>
                <div v-if="isTransferring || isDownloading || isUpdated" class="text-purple-400">
                  > Uploading assets to edge nodes...
                </div>
                <div v-if="isDeploying || isTransferring || isDownloading || isUpdated">
                  > Bundling application...
                </div>
                <div>> Ready for deployment.</div>
              </div>
            </div>

            <!-- Glow Overlay on Transfer -->
            <div
              v-if="isTransferring"
              class="absolute inset-0 bg-primary/5 z-20 pointer-events-none animate-pulse"
            />
          </div>
        </div>

        <!-- RIGHT: Phone Mockup -->
        <div class="relative w-full lg:w-2/5 h-full z-10 flex justify-center lg:justify-end">
          <div
            class="relative w-[300px] h-full bg-stone-900 rounded-[3rem] border-8 border-stone-800 shadow-2xl overflow-hidden transition-all duration-500"
            :class="{
              'shadow-primary/30 scale-105 border-stone-700': isDownloading || isUpdated,
              'grayscale opacity-70': stage === 'idle' || isDeploying,
            }"
          >
            <!-- Notch -->
            <div class="absolute top-0 inset-x-0 h-6 bg-stone-800 rounded-b-xl w-32 mx-auto z-20" />

            <!-- Phone Screen -->
            <div class="h-full w-full bg-white relative flex flex-col">
              <!-- App Header -->
              <div
                class="h-20 bg-stone-100 flex items-end pb-3 px-4 shadow-sm z-10 justify-between"
              >
                <span class="font-bold text-stone-800">My App</span>

                <div class="flex gap-1.5">
                  <div class="w-1.5 h-1.5 rounded-full bg-stone-400" />
                  <div
                    v-if="isDownloading"
                    class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"
                  />
                  <div v-else class="w-1.5 h-1.5 rounded-full bg-stone-400" />
                </div>
              </div>

              <!-- App Content -->
              <div class="flex-1 p-4 space-y-4 overflow-hidden relative">
                <!-- Skeleton UI -->
                <div class="h-40 bg-stone-100 rounded-xl" />
                <div class="space-y-3">
                  <div class="h-4 bg-stone-100 rounded w-3/4" />
                  <div class="h-4 bg-stone-100 rounded w-1/2" />
                </div>

                <!-- New Feature Content (Revealed after update) -->
                <Transition
                  enter-active-class="transition duration-500"
                  enter-from-class="opacity-0 translate-y-10"
                  enter-to-class="opacity-100 translate-y-0"
                >
                  <div v-if="isUpdated" class="absolute inset-x-4 top-[240px]">
                    <div
                      class="bg-green-100 border border-green-200 p-4 rounded-xl text-green-800 text-sm flex items-center gap-3 shadow-lg"
                    >
                      <PartyPopper class="w-5 h-5" />
                      <div>
                        <div class="font-bold">v2.0.0 is here!</div>
                        <div class="text-xs">Enjoy the new features.</div>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>

              <!-- Bottom Nav (Removed) -->
              <div class="h-8 bg-white/90 backdrop-blur w-full absolute bottom-0 inset-x-0" />
              <!-- Just a spacer -->

              <!-- DOWNLOAD OVERLAY -->
              <div
                v-if="isTransferring || isDownloading"
                class="absolute inset-x-4 top-24 bg-stone-900/90 backdrop-blur-md rounded-2xl p-4 shadow-2xl z-30 text-white transform transition-all duration-300"
                :class="isTransferring ? '-translate-y-4 opacity-0' : 'translate-y-0 opacity-100'"
              >
                <div class="flex items-center gap-4 mb-3">
                  <div class="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center">
                    <Download class="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div class="text-sm font-medium">Update Available</div>
                    <div class="text-xs text-stone-400">Downloading v2.0.0...</div>
                  </div>
                </div>
                <!-- Progress Bar -->
                <div class="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-blue-500 transition-all duration-75 ease-out rounded-full"
                    :style="{ width: `${downloadProgress}%` }"
                  />
                </div>
              </div>
            </div>

            <!-- Glow Effect behind phone -->
            <div
              class="absolute -inset-4 bg-primary/20 -z-10 rounded-[3rem] blur-xl transition-opacity duration-500"
              :class="isUpdated || isDownloading ? 'opacity-100' : 'opacity-0'"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.animate-dash {
  stroke-dasharray: 20;
  animation: dash 1s linear infinite;
}

@keyframes dash {
  to {
    stroke-dashoffset: -40;
  }
}
</style>
