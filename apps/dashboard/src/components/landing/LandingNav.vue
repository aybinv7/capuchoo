<script setup lang="ts">
import { Menu, X, Moon, Sun } from 'lucide-vue-next'

const router = useRouter()
const isScrolled = ref(false)
const isMobileMenuOpen = ref(false)
const isDark = ref(false)

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Integrations', href: '#integrations' },
  { label: 'Code', href: '#code' },
  // { label: 'Workflow', href: '#workflow' },
  { label: 'Dashboard', href: '#dashboard' },
  { label: 'Platforms', href: '#platforms' },
]

onMounted(() => {
  const handleScroll = () => {
    isScrolled.value = window.scrollY > 20
  }
  window.addEventListener('scroll', handleScroll)
  onUnmounted(() => window.removeEventListener('scroll', handleScroll))

  // Check initial dark mode
  isDark.value = document.documentElement.classList.contains('dark')
})

const toggleDarkMode = () => {
  document.documentElement.classList.toggle('dark')
  isDark.value = !isDark.value
}

const scrollToSection = (href: string) => {
  if (href.startsWith('#')) {
    const element = document.querySelector(href)
    element?.scrollIntoView({ behavior: 'smooth' })
  } else {
    router.push(href)
  }
  isMobileMenuOpen.value = false
}
</script>

<template>
  <!-- Main Static Header -->
  <!-- Mobile: Fixed + Glass when scrolled | Desktop: Absolute (scrolls away) -->
  <nav
    class="w-full z-40 transition-all duration-400 ease-in-out md:absolute md:top-0 fixed top-0"
    :class="[
      isScrolled &&
        'md:bg-transparent bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm md:shadow-none md:border-none',
    ]"
  >
    <div class="grid grid-cols-2 md:grid-cols-3 h-16 px-4 md:px-6 items-center max-w-7xl mx-auto">
      <!-- Logo (Left Section) -->
      <a href="/" class="flex items-center gap-2.5 group justify-start w-fit">
        <div
          class="shadow-primary/20 flex group-hover:rotate-12 transition-transform duration-300 w-8 h-8 rounded-xl shadow-lg rotate-3 items-center justify-center overflow-hidden"
        >
          <img src="/assets/capucho.png" alt="Capucho Logo" class="w-10 h-10 object-cover" />
        </div>
        <span class="text-lg font-bold tracking-tight">Capucho</span>
      </a>

      <!-- Desktop Nav (Static) - Hides when scrolled to avoid duplication if we want smooth transition, but user wants it to "stay at top". -->
      <!-- Actually, if we want it to "stay at top" vs "fixed", the static one just scrolls up. -->
      <!-- We show this one when at the top. -->
      <div
        class="hidden md:flex justify-center transition-opacity duration-300"
        :class="{ 'opacity-0 pointer-events-none': isScrolled }"
      >
        <div class="flex items-center gap-1 bg-transparent p-1 px-4">
          <a
            v-for="link in navLinks"
            :key="link.label"
            @click.prevent="scrollToSection(link.href)"
            class="px-4 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            {{ link.label }}
          </a>
        </div>
      </div>

      <!-- Right Actions (Right Section) -->
      <div class="flex items-center gap-4 justify-end">
        <button
          @click="toggleDarkMode"
          class="p-2 rounded-full hidden md:block text-muted-foreground hover:bg-muted transition-colors"
        >
          <Moon v-if="!isDark" class="w-4 h-4" />
          <Sun v-else class="w-4 h-4" />
        </button>
        <a
          href="/auth/login"
          class="hidden sm:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Log in
        </a>
        <Button
          size="sm"
          class="rounded-full px-5 shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
          @click="router.push('/auth/login')"
        >
          Get Started
        </Button>

        <!-- Mobile Menu Button -->
        <button
          class="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          @click="isMobileMenuOpen = !isMobileMenuOpen"
        >
          <Menu v-if="!isMobileMenuOpen" class="h-5 w-5" />
          <X v-else class="h-5 w-5" />
        </button>
      </div>
    </div>

    <!-- Mobile Menu Container (Absolute to header) -->
    <div
      v-if="isMobileMenuOpen"
      class="md:hidden bg-background/95 backdrop-blur-lg border-b border-border absolute w-full top-16 left-0"
    >
      <div class="px-6 py-4 space-y-4">
        <a
          v-for="link in navLinks"
          :key="link.label"
          @click.prevent="scrollToSection(link.href)"
          class="block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-2"
        >
          {{ link.label }}
        </a>
        <div class="flex flex-col gap-2 pt-4 border-t border-border">
          <Button variant="outline" class="w-full" @click="router.push('/auth/login')">
            Log in
          </Button>
          <Button class="w-full" @click="router.push('/auth/login')"> Get Started </Button>
        </div>
      </div>
    </div>
  </nav>

  <!-- Floating Desktop Nav (Fixed) -->
  <div
    class="fixed z-50 top-4 left-1/2 -translate-x-1/2 transition-all duration-500 ease-spring hidden md:block"
    :class="
      isScrolled ? 'translate-y-0 opacity-100' : '-translate-y-16 opacity-0 pointer-events-none'
    "
  >
    <div
      class="flex items-center gap-1 bg-stone-900/80 backdrop-blur-xl border border-stone-800 p-1.5 rounded-full shadow-xl"
    >
      <a
        v-for="link in navLinks"
        :key="link.label"
        @click.prevent="scrollToSection(link.href)"
        class="px-5 py-2 rounded-full text-sm font-medium text-stone-400 hover:text-white hover:bg-stone-800 transition-all cursor-pointer"
      >
        {{ link.label }}
      </a>

      <!-- Mini CTA in pill -->
      <div class="w-px h-4 bg-stone-800 mx-2" />

      <!-- Theme Toggle -->
      <button
        @click="toggleDarkMode"
        class="p-2 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition-colors mr-1"
      >
        <Moon v-if="!isDark" class="w-4 h-4" />
        <Sun v-else class="w-4 h-4" />
      </button>

      <button
        @click="router.push('/auth/login')"
        class="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 transition-all"
      >
        Start
      </button>
    </div>
  </div>
</template>
