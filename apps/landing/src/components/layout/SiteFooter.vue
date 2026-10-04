<script setup lang="ts">
import GithubMark from "@/components/ui/GithubMark.vue";
import { NAV_LINKS, SITE } from "@/config/site";

const RESOURCES = [
  { label: "Read me", href: SITE.readme },
  { label: "Self-hosting guide", href: SITE.selfHosting },
  { label: "Adding an app", href: SITE.addingAnApp },
  { label: "Server contract", href: SITE.serverContract },
];

const PACKAGES = [
  { label: "@capuchoo/cli", href: SITE.npmCli },
  { label: "@capuchoo/updater", href: SITE.npmUpdater },
  { label: "@capuchoo/recorder", href: SITE.npmRecorder },
];

const year = new Date().getFullYear();
</script>

<template>
  <footer class="border-border bg-ink text-ink-muted border-t">
    <div class="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <div class="space-y-4">
        <div class="flex items-center gap-2.5">
          <img src="/capuchoo.png" alt="" width="32" height="32" class="size-8 rounded-xl" />
          <span class="text-ink-foreground text-lg font-bold tracking-tight">Capuchoo</span>
        </div>
        <p class="max-w-xs text-sm leading-relaxed">
          Over-the-air and native updates for Capacitor apps, on a server you run.
        </p>
        <a
          :href="SITE.repository"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-ink-foreground inline-flex items-center gap-2 text-sm transition-colors"
        >
          <GithubMark class="size-4" />
          Source on GitHub
        </a>
      </div>
      <nav aria-label="Page" class="space-y-3 text-sm">
        <p class="text-ink-foreground font-medium">On this page</p>
        <a
          v-for="link in NAV_LINKS"
          :key="link.href"
          :href="link.href"
          class="hover:text-ink-foreground block transition-colors"
          >{{ link.label }}</a
        >
      </nav>
      <nav aria-label="Documentation" class="space-y-3 text-sm">
        <p class="text-ink-foreground font-medium">Documentation</p>
        <a
          v-for="link in RESOURCES"
          :key="link.href"
          :href="link.href"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-ink-foreground block transition-colors"
          >{{ link.label }}</a
        >
      </nav>
      <nav aria-label="Packages" class="space-y-3 text-sm">
        <p class="text-ink-foreground font-medium">Packages</p>
        <a
          v-for="link in PACKAGES"
          :key="link.href"
          :href="link.href"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-ink-foreground block font-mono text-xs transition-colors"
          >{{ link.label }}</a
        >
        <a :href="SITE.dashboardUrl" class="hover:text-ink-foreground block transition-colors"
          >Dashboard sign-in</a
        >
      </nav>
    </div>
    <div class="border-ink-border border-t">
      <p class="mx-auto max-w-7xl px-6 py-5 text-xs">© {{ year }} Capuchoo</p>
    </div>
  </footer>
</template>
