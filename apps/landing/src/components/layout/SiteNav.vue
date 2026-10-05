<script setup lang="ts">
import { Menu, Moon, Sun, X } from "@lucide/vue";
import { onKeyStroke, useWindowScroll } from "@vueuse/core";
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import GithubMark from "@/components/ui/GithubMark.vue";
import { useTheme } from "@/composables/useTheme";
import { NAV_LINKS, SITE } from "@/config/site";

const { y } = useWindowScroll({ throttle: 50 });
const scrolled = computed(() => y.value > 24);
const menuOpen = ref(false);
const { isDark, toggle } = useTheme();

onKeyStroke("Escape", () => {
  menuOpen.value = false;
});
</script>

<template>
  <nav
    aria-label="Main"
    class="fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300 md:absolute"
    :class="
      scrolled &&
      'bg-background/85 border-border/60 border-b shadow-sm backdrop-blur-md md:border-transparent md:bg-transparent md:shadow-none md:backdrop-blur-none'
    "
  >
    <div
      class="mx-auto grid h-16 max-w-7xl grid-cols-2 items-center px-4 md:grid-cols-[1fr_auto_1fr] md:px-6"
    >
      <a href="#top" class="group flex w-fit items-center gap-2.5" aria-label="Capuchoo home">
        <img
          src="/capuchoo.png"
          alt=""
          width="32"
          height="32"
          class="size-8 rotate-3 rounded-xl shadow-lg shadow-primary/20 transition-transform duration-300 group-hover:rotate-12"
        />
        <span class="text-lg font-bold tracking-tight">Capuchoo</span>
      </a>

      <div
        class="hidden items-center gap-1 transition-opacity duration-300 md:flex"
        :class="scrolled && 'pointer-events-none opacity-0'"
      >
        <a
          v-for="link in NAV_LINKS"
          :key="link.href"
          :href="link.href"
          class="text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors"
          >{{ link.label }}</a
        >
      </div>

      <div class="flex items-center justify-end gap-2 md:gap-3">
        <button
          type="button"
          class="text-muted-foreground hover:bg-muted hidden rounded-full p-2 transition-colors md:inline-flex"
          :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
          @click="toggle"
        >
          <Sun v-if="isDark" class="size-4" />
          <Moon v-else class="size-4" />
        </button>
        <a
          :href="SITE.repository"
          target="_blank"
          rel="noopener noreferrer"
          class="text-muted-foreground hover:text-foreground hidden rounded-full p-2 transition-colors sm:inline-flex"
          aria-label="Source on GitHub"
        >
          <GithubMark class="size-4" />
        </a>
        <Button
          as="a"
          :href="SITE.dashboardUrl"
          size="sm"
          class="rounded-full px-5 shadow-lg shadow-primary/20 transition-transform hover:scale-105"
        >
          Sign in
        </Button>
        <button
          type="button"
          class="hover:bg-muted rounded-lg p-2 transition-colors md:hidden"
          :aria-expanded="menuOpen"
          aria-controls="mobile-menu"
          :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
          @click="menuOpen = !menuOpen"
        >
          <X v-if="menuOpen" class="size-5" />
          <Menu v-else class="size-5" />
        </button>
      </div>
    </div>

    <div
      v-if="menuOpen"
      id="mobile-menu"
      class="bg-background/95 border-border absolute inset-x-0 top-16 border-b backdrop-blur-lg md:hidden"
    >
      <div class="space-y-1 px-6 py-4">
        <a
          v-for="link in NAV_LINKS"
          :key="link.href"
          :href="link.href"
          class="text-muted-foreground hover:text-foreground block py-2 text-sm font-medium"
          @click="menuOpen = false"
          >{{ link.label }}</a
        >
        <div class="border-border mt-3 flex items-center justify-between border-t pt-4">
          <a
            :href="SITE.repository"
            target="_blank"
            rel="noopener noreferrer"
            class="text-muted-foreground flex items-center gap-2 text-sm"
          >
            <GithubMark class="size-4" />
            GitHub
          </a>
          <button
            type="button"
            class="text-muted-foreground flex items-center gap-2 text-sm"
            @click="toggle"
          >
            <Sun v-if="isDark" class="size-4" />
            <Moon v-else class="size-4" />
            {{ isDark ? "Light" : "Dark" }} theme
          </button>
        </div>
      </div>
    </div>
  </nav>

  <div
    class="fixed top-4 left-1/2 z-50 hidden -translate-x-1/2 transition-all duration-500 md:block"
    :class="
      scrolled ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-16 opacity-0'
    "
    :aria-hidden="!scrolled"
  >
    <div
      class="border-ink-border bg-ink/85 flex items-center gap-1 rounded-full border p-1.5 shadow-xl backdrop-blur-xl"
    >
      <a
        v-for="link in NAV_LINKS"
        :key="link.href"
        :href="link.href"
        :tabindex="scrolled ? 0 : -1"
        class="text-ink-muted rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-white/10 hover:text-white"
        >{{ link.label }}</a
      >
      <span class="bg-ink-border mx-2 h-4 w-px" />
      <button
        type="button"
        :tabindex="scrolled ? 0 : -1"
        class="text-ink-muted mr-1 rounded-full p-2 transition-colors hover:bg-white/10 hover:text-white"
        :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="toggle"
      >
        <Sun v-if="isDark" class="size-4" />
        <Moon v-else class="size-4" />
      </button>
      <a
        :href="SITE.dashboardUrl"
        :tabindex="scrolled ? 0 : -1"
        class="bg-primary text-primary-foreground rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap transition hover:brightness-110"
        >Sign in</a
      >
    </div>
  </div>
</template>
