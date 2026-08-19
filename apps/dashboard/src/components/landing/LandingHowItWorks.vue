<script setup lang="ts">
import { Upload, Target, Rocket, Check } from 'lucide-vue-next'

const steps = [
  {
    number: '01',
    icon: Upload,
    title: 'Upload Your Bundle',
    description:
      'Build your app and upload the bundle to CapGO. We support Capacitor, Cordova, and more.',
    details: ['Automatic versioning', 'Bundle diff optimization', 'Code signature verification'],
  },
  {
    number: '02',
    icon: Target,
    title: 'Target Your Devices',
    description:
      'Choose which devices receive the update. Use channels for beta testing or gradual rollouts.',
    details: ['Device targeting', 'Percentage rollouts', 'A/B testing'],
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Push Live Updates',
    description:
      'Hit deploy and your users receive the update instantly. No app store, no waiting.',
    details: ['Instant delivery', 'Background updates', 'Force update option'],
  },
]
</script>

<template>
  <section id="how-it-works" class="py-24 lg:py-32">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <!-- Section Header -->
      <div class="text-center max-w-3xl mx-auto mb-20">
        <Badge variant="secondary" class="mb-4">How It Works</Badge>
        <h2 class="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Three steps to
          <span class="text-primary">faster releases</span>
        </h2>
        <p class="text-lg text-muted-foreground">
          Get started in minutes. No complex setup required.
        </p>
      </div>

      <!-- Steps -->
      <div class="relative">
        <!-- Connector line (desktop) -->
        <div
          class="hidden lg:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-border to-transparent"
        />

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-8">
          <div v-for="(step, index) in steps" :key="index" class="relative">
            <!-- Step Card -->
            <div class="relative bg-card rounded-2xl border border-border p-8 h-full">
              <!-- Step number badge -->
              <div
                class="absolute -top-4 left-8 px-4 py-1 rounded-full bg-primary text-primary-foreground text-sm font-bold"
              >
                {{ step.number }}
              </div>

              <!-- Icon -->
              <div
                class="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 mb-6 mt-4"
              >
                <component :is="step.icon" class="h-7 w-7 text-primary" />
              </div>

              <!-- Content -->
              <h3 class="text-xl font-semibold mb-3">{{ step.title }}</h3>
              <p class="text-muted-foreground mb-6">{{ step.description }}</p>

              <!-- Details list -->
              <ul class="space-y-2">
                <li
                  v-for="detail in step.details"
                  :key="detail"
                  class="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Check class="h-4 w-4 text-primary flex-shrink-0" />
                  {{ detail }}
                </li>
              </ul>
            </div>

            <!-- Arrow connector (mobile) -->
            <div v-if="index < steps.length - 1" class="lg:hidden flex justify-center py-4">
              <div class="h-8 w-0.5 bg-border" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
