<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import SquareGrids from '@/components/vuebits/SquareGrids.vue'

const router = useRouter()
const isMounted = ref(false)
const mouseX = ref(0)
const mouseY = ref(0)

const handleMouseMove = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  mouseX.value = (e.clientX - rect.left - rect.width / 2) / rect.width
  mouseY.value = (e.clientY - rect.top - rect.height / 2) / rect.height
}

onMounted(() => {
  setTimeout(() => (isMounted.value = true), 100)
})
</script>

<template>
  <section
    class="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6 overflow-hidden"
    @mousemove="handleMouseMove"
  >
    <SquareGrids
      direction="diagonal"
      :speed="0.3"
      :squareSize="50"
      borderColor="#ce6d2c"
      hoverFillColor="#ce6d2c"
      class="absolute top-0 left-0 opacity-20"
    />

    <!-- Content -->
    <div class="flex flex-col z-10 text-center max-w-5xl mx-auto relative items-center">
      <!-- Announcement Badge -->
      <div
        :class="[
          'inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8',
          'bg-card border border-primary/20 shadow-sm backdrop-blur-sm',
          'transition-all duration-1000',
          isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4',
        ]"
      >
        <span class="relative flex h-2 w-2">
          <span
            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"
          />
          <span class="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <span class="text-xs font-semibold text-primary tracking-wide uppercase">
          Capucho 2.0 Released
        </span>
      </div>

      <!-- Headline -->
      <h1
        :class="[
          'font-sans  font-semibold text-5xl md:text-7xl lg:text-8xl leading-[0.9] tracking-tight mb-8 max-w-4xl space-y-2',
          'transition-all duration-1000 delay-150',
          isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
        ]"
      >
        Deploy with
        <br />
        <span class="text-shiny noto-serif-display-300 font-thin italic pr-2"
          >intelligent precision.</span
        >
      </h1>

      <!-- Subheadline -->
      <p
        :class="[
          'text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed mb-10',
          'transition-all duration-1000 delay-300',
          isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
        ]"
      >
        The atomic deployment engine for hybrid apps. Seamlessly orchestrate OTA updates and native
        binary releases from a single, shiny dashboard.
      </p>

      <!-- CTAs -->
      <div
        :class="[
          'flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto',
          'transition-all duration-1000 delay-500',
          isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
        ]"
      >
        <Button
          size="lg"
          class="group w-full sm:w-auto px-8 py-3.5 rounded-full font-medium shadow-xl shadow-primary/20"
          @click="router.push('/auth/login')"
        >
          Start Deploying
          <ArrowRight class="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Button>
        <Button
          variant="outline"
          size="lg"
          class="w-full sm:w-auto px-8 py-3.5 rounded-full font-medium"
        >
          View Documentation
        </Button>
      </div>
    </div>
  </section>
</template>

<style scoped>
@keyframes shine {
  to {
    background-position: 200% center;
  }
}
</style>
