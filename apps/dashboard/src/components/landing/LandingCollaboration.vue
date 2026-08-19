<script setup lang="ts">
import { Users, Shield, Key } from 'lucide-vue-next'
import AnimatedUnderline from './AnimatedUnderline.vue'
</script>

<template>
  <section id="team" class="py-24 relative overflow-hidden">
    <div class="max-w-7xl mx-auto px-6">
      <div class="flex flex-col lg:flex-row items-center gap-16">
        <!-- Text Content -->
        <div class="flex-1 space-y-8">
          <div
            class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900/50 text-stone-100 w-fit"
          >
            <Users class="w-4 h-4" />
            <span class="text-sm font-semibold">Collaboration</span>
          </div>

          <h2 class="text-3xl md:text-5xl font-bold leading-tight">
            Built for
            <span class="noto-serif-display-300 font-thin italic relative">
              collaboration
              <span class="absolute -bottom-2 left-0 right-0 z-0">
                <AnimatedUnderline />
              </span>
            </span>
          </h2>

          <p class="text-muted-foreground text-lg leading-relaxed">
            Granular control over who can deploy, manage, and view your apps. Secure your workflow
            with Role-Based Access Control (RBAC).
          </p>

          <div class="space-y-6">
            <div class="flex gap-4">
              <div
                class="w-12 h-12 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center shrink-0"
              >
                <Shield class="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 class="font-bold text-lg mb-1">Role-Based Access</h3>
                <p class="text-stone-400">
                  Assign roles like Admin, Developer, or Viewer to organization members.
                </p>
              </div>
            </div>

            <div class="flex gap-4">
              <div
                class="w-12 h-12 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center shrink-0"
              >
                <Key class="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 class="font-bold text-lg mb-1">Secure API Keys</h3>
                <p class="text-stone-400">
                  Generate scoped API keys for CI/CD pipelines and external integrations.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Visual Content -->
        <div class="flex-1 relative w-full aspect-square md:aspect-auto md:h-[500px]">
          <!-- Abstract Team UI Representation -->
          <div
            class="absolute inset-0 bg-linear-to-tr from-primary/20 to-transparent rounded-[3rem] blur-3xl -z-10"
          />

          <div
            class="relative w-full h-full border border-stone-800 bg-background rounded-3xl overflow-hidden shadow-2xl p-6 flex flex-col gap-4"
          >
            <!-- Bento Gradient -->
            <div class="absolute inset-0 bg-linear-to-br from-stone-800 to-stone-950 opacity-100" />

            <!-- Glow Edge -->
            <div
              class="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-stone-500 to-transparent opacity-50"
            />

            <div class="relative z-10 flex flex-col gap-4 h-full">
              <!-- Header Mock -->
              <div class="flex justify-between items-center pb-4 border-b border-stone-800">
                <div class="font-bold text-foreground">Organization Settings</div>
                <button
                  class="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg font-medium"
                >
                  Invite Member
                </button>
              </div>

              <!-- Members List Mock -->
              <div class="space-y-3">
                <div
                  v-for="i in 4"
                  :key="i"
                  class="flex items-center gap-3 p-3 rounded-xl bg-stone-900/50 border border-stone-800/50"
                >
                  <div class="w-8 h-8 rounded-full bg-stone-800" />
                  <div class="flex-1">
                    <div class="h-2.5 w-24 bg-stone-800 rounded mb-1.5" />
                    <div class="h-2 w-16 bg-stone-800 rounded opacity-60" />
                  </div>
                  <div class="px-2 py-1 rounded text-xs bg-stone-800 text-stone-400">
                    {{ ['Owner', 'Admin', 'Developer', 'Viewer'][i - 1] }}
                  </div>
                </div>
              </div>

              <!-- Permission Toggle Mock -->
              <div class="mt-auto p-4 rounded-xl bg-stone-900/80 border border-stone-800">
                <div class="flex justify-between items-center mb-3">
                  <span class="text-sm font-medium">Require Approval for Produciton</span>
                  <div class="w-10 h-6 bg-primary rounded-full relative">
                    <div class="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                  </div>
                </div>
                <div class="text-xs text-stone-500">
                  Admins must approve deployments to the production channel.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
