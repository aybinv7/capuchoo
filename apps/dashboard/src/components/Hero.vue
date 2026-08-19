<template>
  <section class="relative isolate h-screen overflow-hidden bg-black text-white">
    <!-- ================== BACKGROUND ================== -->
    <div
      aria-hidden="true"
      class="absolute inset-0 -z-30"
      :style="{
        backgroundImage: [
          'radial-gradient(80% 55% at 50% 52%, rgba(252,166,154,0.45) 0%, rgba(214,76,82,0.46) 27%, rgba(61,36,47,0.38) 47%, rgba(39,38,67,0.45) 60%, rgba(8,8,12,0.92) 78%, rgba(0,0,0,1) 88%)',
          'radial-gradient(85% 60% at 14% 0%, rgba(255,193,171,0.65) 0%, rgba(233,109,99,0.58) 30%, rgba(48,24,28,0.0) 64%)',
          'radial-gradient(70% 50% at 86% 22%, rgba(88,112,255,0.40) 0%, rgba(16,18,28,0.0) 55%)',
          'linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0) 40%)',
        ].join(','),
        backgroundColor: '#000',
      }"
    />

    <div
      aria-hidden="true"
      class="absolute inset-0 -z-20 bg-[radial-gradient(140%_120%_at_50%_0%,transparent_60%,rgba(0,0,0,0.85))]"
    />

    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 -z-10 mix-blend-screen opacity-30"
      :style="{
        backgroundImage: [
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.09) 0 1px, transparent 1px 96px)',
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 24px)',
          'repeating-radial-gradient(80% 55% at 50% 52%, rgba(255,255,255,0.08) 0 1px, transparent 1px 120px)',
        ].join(','),
        backgroundBlendMode: 'screen',
      }"
    />

    <!-- ================== NAV ================== -->
    <header class="relative z-10">
      <div class="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 md:px-8">
        <div class="flex items-center gap-3">
          <img :src="capgoLogo" class="aspect-square size-7" alt="capgo Logo" />
          <span class="text-lg font-semibold tracking-tight">capgo</span>
        </div>

        <nav class="hidden items-center gap-8 text-sm/6 text-white/80 md:flex">
          <a
            v-for="item in ['Product', 'Docs', 'Customers', 'Resources', 'Partners', 'Pricing']"
            :key="item"
            href="#"
            class="hover:text-white"
          >
            {{ item }}
          </a>
        </nav>

        <div class="hidden items-center gap-3 md:flex">
          <Button
            variant="ghost"
            @click="router.push('/auth/Login')"
            class="rounded-full px-4 py-2 text-sm"
          >
            Sign in
          </Button>
          <Button
            @click="router.push('/auth/Login')"
            class="rounded-full px-4 py-2 text-sm font-medium shadow-sm transition"
          >
            Request Demo
          </Button>
        </div>

        <button class="md:hidden rounded-full bg-white/10 px-3 py-2 text-sm">Menu</button>
      </div>
    </header>

    <!-- ================== COPY ================== -->
    <div
      class="relative z-10 mx-auto grid w-full max-w-5xl place-items-center px-6 py-16 md:py-24 lg:py-28"
    >
      <div class="mx-auto text-center" :class="isMounted ? 'animate-fadeInUp' : 'opacity-0'">
        <span
          class="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wider text-white/70 ring-1 ring-white/10 backdrop-blur"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-white/70" />
          <ShinyText text="AI Store" :disabled="false" :speed="3" class-name="your-custom-class" />
        </span>

        <h1
          class="mt-6 text-4xl font-bold tracking-tight md:text-6xl capitalize"
          :class="isMounted ? 'animate-fadeInUp' : 'opacity-0'"
          style="animation-delay: 200ms"
        >
          Revolutionize the algerian e-commerce market
        </h1>

        <p
          class="mx-auto mt-5 max-w-2xl text-balance text-white/80 md:text-lg"
          :class="isMounted ? 'animate-fadeInUp' : 'opacity-0'"
          style="animation-delay: 300ms"
        >
          The essential toolkit for building your next store , scale and evolve
        </p>

        <div
          class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          :class="isMounted ? 'animate-fadeInUp' : 'opacity-0'"
          style="animation-delay: 400ms"
        >
          <a
            @click="router.push('/auth/Login')"
            class="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow transition hover:bg-white/90"
          >
            Try capgo
          </a>
          <a
            @click="router.push('/auth/Login')"
            class="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/90 backdrop-blur hover:border-white/40"
          >
            Read More
          </a>
        </div>
      </div>
    </div>

    <!-- ================== FOREGROUND ================== -->
    <div
      class="pointer-events-none absolute bottom-32 left-1/2 z-0 h-36 w-28 -translate-x-1/2 rounded-md bg-linear-to-b from-white/75 via-rose-100/60 to-transparent"
      style="animation: subtlePulse 6s ease-in-out infinite"
    />

    <!-- Stepped pillars silhouette -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[54vh]">
      <div class="absolute inset-0 bg-linear-to-t from-black via-black/90 to-transparent" />
      <div class="absolute inset-x-0 bottom-0 flex h-full items-end gap-px px-0.5">
        <div
          v-for="(h, i) in pillars"
          :key="i"
          class="flex-1 bg-black transition-[height] duration-1000 ease-in-out"
          :style="{
            height: isMounted ? `${h}%` : '0%',
            transitionDelay: `${Math.abs(i - Math.floor(pillars.length / 2)) * 60}ms`,
          }"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import capgoLogo from '@/assets/images/capucho.png'
const router = useRouter()
const pillars = [92, 84, 78, 70, 62, 54, 46, 34, 18, 34, 46, 54, 62, 70, 78, 84, 92]
const isMounted = ref(false)

let timer: number | undefined

onMounted(() => {
  timer = window.setTimeout(() => (isMounted.value = true), 100)
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})
</script>

<style scoped>
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes subtlePulse {
  0%,
  100% {
    opacity: 0.8;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.03);
  }
}

.animate-fadeInUp {
  animation: fadeInUp 0.8s ease-out forwards;
}
</style>
