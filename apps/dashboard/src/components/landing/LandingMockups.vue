<script setup lang="ts">
import { Monitor, Smartphone } from 'lucide-vue-next'
</script>

<template>
  <section class="py-24 lg:py-32 bg-muted/30 overflow-hidden">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <!-- Section Header -->
      <div class="text-center max-w-3xl mx-auto mb-16">
        <Badge variant="secondary" class="mb-4">Platform Preview</Badge>
        <h2 class="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          Powerful dashboard,
          <span class="text-primary">simple interface</span>
        </h2>
        <p class="text-lg text-muted-foreground">
          Everything you need to manage your app updates in one place.
        </p>
      </div>

      <!-- Mockup Container -->
      <div class="relative">
        <!-- Desktop Mockup (Browser Frame) -->
        <div class="relative mx-auto max-w-5xl">
          <!-- Browser Chrome -->
          <div class="rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            <!-- Browser Header -->
            <div class="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
              <div class="flex gap-1.5">
                <div class="w-3 h-3 rounded-full bg-red-500/80" />
                <div class="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div class="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div class="flex-1 flex justify-center">
                <div
                  class="flex items-center gap-2 px-4 py-1 rounded-md bg-background/50 text-xs text-muted-foreground"
                >
                  <Monitor class="h-3 w-3" />
                  app.capgo.io/dashboard
                </div>
              </div>
            </div>

            <!-- Browser Content (Dashboard Preview) -->
            <div class="aspect-[16/9] bg-background relative">
              <!-- Placeholder Dashboard UI -->
              <div class="absolute inset-0 p-6">
                <!-- Header -->
                <div class="flex items-center justify-between mb-6">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-primary/20" />
                    <div>
                      <div class="h-4 w-32 bg-muted rounded" />
                      <div class="h-3 w-20 bg-muted/50 rounded mt-1" />
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <div class="h-9 w-24 rounded-lg bg-primary/20" />
                    <div class="h-9 w-9 rounded-lg bg-muted" />
                  </div>
                </div>

                <!-- Stats Cards -->
                <div class="grid grid-cols-4 gap-4 mb-6">
                  <div v-for="i in 4" :key="i" class="p-4 rounded-xl bg-card border border-border">
                    <div class="h-3 w-16 bg-muted rounded mb-2" />
                    <div class="h-6 w-12 bg-primary/30 rounded" />
                  </div>
                </div>

                <!-- Chart Area -->
                <div class="h-48 bg-card rounded-xl border border-border p-4">
                  <div class="h-3 w-24 bg-muted rounded mb-4" />
                  <div class="relative h-32">
                    <svg class="w-full h-full" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop
                            offset="0%"
                            style="stop-color: hsl(var(--primary)); stop-opacity: 0.3"
                          />
                          <stop
                            offset="100%"
                            style="stop-color: hsl(var(--primary)); stop-opacity: 0"
                          />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,100 Q50,80 100,60 T200,40 T300,55 T400,30 L400,130 L0,130 Z"
                        fill="url(#chartGradient)"
                        class="scale-x-[calc(100%/400)]"
                      />
                      <path
                        d="M0,100 Q50,80 100,60 T200,40 T300,55 T400,30"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        stroke-width="2"
                        class="scale-x-[calc(100%/400)]"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Mobile Mockups (Floating) -->
          <div class="hidden lg:block absolute -bottom-8 -right-8 w-48">
            <!-- Android -->
            <div
              class="rounded-3xl border-4 border-foreground/10 bg-card shadow-xl overflow-hidden"
            >
              <div class="aspect-[9/19] bg-background p-2">
                <div
                  class="h-full w-full rounded-xl bg-muted/30 flex flex-col items-center justify-center gap-2"
                >
                  <Smartphone class="h-8 w-8 text-primary/50" />
                  <div class="text-xs text-muted-foreground text-center px-4">Update Available</div>
                  <div class="h-6 w-16 rounded-full bg-primary/30" />
                </div>
              </div>
            </div>
          </div>

          <div class="hidden lg:block absolute -bottom-4 -left-4 w-40">
            <!-- iOS -->
            <div
              class="rounded-3xl border-4 border-foreground/10 bg-card shadow-xl overflow-hidden"
            >
              <div class="aspect-[9/19] bg-background p-2">
                <div
                  class="h-full w-full rounded-xl bg-muted/30 flex flex-col items-center justify-center gap-2"
                >
                  <div class="h-8 w-8 rounded-xl bg-primary/30" />
                  <div class="text-xs text-muted-foreground text-center px-4">Installing...</div>
                  <div class="h-2 w-20 rounded-full bg-muted overflow-hidden">
                    <div class="h-full w-3/4 bg-primary rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
