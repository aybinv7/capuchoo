<script setup lang="ts">
import { GitCommit, Package, Zap } from 'lucide-vue-next'

const steps = [
  {
    icon: GitCommit,
    title: 'Push Code',
    description: 'Git push triggers the CI pipeline. Capucho CLI detects changes.',
    code: '> git commit -m "fix: login UI"\n> git push origin main',
    active: false,
  },
  {
    icon: Package,
    title: 'Build & Diff',
    description: 'We build the bundle and calculate the binary difference.',
    code: 'Building bundle... [800ms]\nGenerating diff... [45ms]',
    active: false,
  },
  {
    icon: Zap,
    title: 'Instant OTA',
    description: 'Users download only the changed bits in the background.',
    badge: 'Live in production',
    active: true,
  },
]
</script>

<template>
  <section id="workflow" class="py-24 bg-muted/50 border-y border-border">
    <div class="max-w-5xl mx-auto px-6">
      <!-- Section Header -->
      <div class="mb-16">
        <span class="text-primary font-mono text-xs uppercase tracking-wider mb-2 block">
          The Pipeline
        </span>
        <h2 class="text-4xl font-serif">From Commit to Customer</h2>
      </div>

      <div class="relative">
        <!-- Connecting Line -->
        <div class="absolute left-8 top-0 bottom-0 w-0.5 bg-border md:left-1/2 md:-ml-px" />

        <!-- Steps -->
        <div
          v-for="(step, index) in steps"
          :key="index"
          class="relative flex flex-col md:flex-row items-center gap-8 mb-16 last:mb-0 group"
        >
          <!-- Left Content (odd steps) -->
          <div class="flex-1 md:text-right" :class="index % 2 === 1 && 'md:hidden'">
            <template v-if="index % 2 === 0">
              <h3 class="text-xl font-bold">{{ step.title }}</h3>
              <p class="text-muted-foreground mt-2">{{ step.description }}</p>
            </template>
            <template v-else>
              <div
                class="bg-card p-4 rounded-lg border border-border shadow-sm text-xs font-mono text-muted-foreground whitespace-pre-line"
              >
                {{ step.code }}
              </div>
            </template>
          </div>

          <!-- Icon Circle -->
          <div
            :class="[
              'relative z-10 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300',
              'group-hover:scale-110',
              step.active
                ? 'bg-primary shadow-primary/30'
                : 'bg-card border-4 border-border group-hover:border-primary',
            ]"
          >
            <component
              :is="step.icon"
              :class="[
                'w-6 h-6 transition-colors',
                step.active
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground group-hover:text-primary',
              ]"
            />
          </div>

          <!-- Right Content -->
          <div class="flex-1" :class="index % 2 === 1 && 'md:text-right'">
            <template v-if="index % 2 === 1">
              <h3 class="text-xl font-bold">{{ step.title }}</h3>
              <p class="text-muted-foreground mt-2">{{ step.description }}</p>
            </template>
            <template v-else-if="step.code">
              <div
                class="bg-card p-4 rounded-lg border border-border shadow-sm text-xs font-mono text-muted-foreground whitespace-pre-line"
              >
                {{ step.code }}
              </div>
            </template>
            <template v-else-if="step.badge">
              <div
                class="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-xs font-medium border border-green-500/20"
              >
                <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {{ step.badge }}
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
