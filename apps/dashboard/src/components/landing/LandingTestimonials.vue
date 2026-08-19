<script setup lang="ts">
import { Star, Quote } from 'lucide-vue-next'
import LandingMarquee from '@/components/landing/LandingMarquee.vue'

const testimonials = [
  {
    content:
      'Capucho completely transformed our deployment pipeline. We push updates 10x faster now!',
    author: 'Sarah Chen',
    role: 'CTO, TechFlow',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
  },
  {
    content: 'The binary diffing is magic. Our users on slow connections are finally happy.',
    author: 'Michael Ross',
    role: 'Lead Dev, Appify',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael',
  },
  {
    content:
      'Finally a solution that handles both native and OTA updates in one place. A game changer.',
    author: 'Jessica Li',
    role: 'Product Manager, ScaleUp',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica',
  },
  {
    content: 'The rollback feature saved us during a critical bug. Worth every penny.',
    author: 'David Miller',
    role: 'Engineering Manager, FinTech Co',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
  },
  {
    content: 'Setup was incredibly easy. We were running in production within an hour.',
    author: 'Emily Watson',
    role: 'DevOps Lead, CloudSystem',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily',
  },
  {
    content: 'Best in class support. The team really cares about their customers.',
    author: 'James Wilson',
    role: 'Founder, StartupX',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
  },
]

// Split reviews into columns for the marquee effect
const firstColumn = testimonials.slice(0, 3)
const secondColumn = testimonials.slice(3, 6)
</script>

<template>
  <section id="testimonials" class="py-24 bg-stone-950 overflow-hidden relative">
    <div class="max-w-7xl mx-auto px-6 relative z-10">
      <div class="text-center mb-16">
        <h2 class="text-3xl md:text-5xl font-bold mb-6">Loved by developers</h2>
        <p class="text-muted-foreground text-lg max-w-2xl mx-auto">
          Join thousands of developers delivering better apps with Capucho.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 h-[600px]">
        <!-- Column 1 -->
        <LandingMarquee vertical :duration="40" class="h-full">
          <div
            v-for="(testimonial, index) in firstColumn"
            :key="index"
            class="bg-stone-900 border border-stone-800 p-8 rounded-3xl relative overflow-hidden group shadow-lg"
          >
            <!-- Bento Gradient Config -->
            <div class="absolute inset-0 bg-linear-to-br from-stone-800 to-stone-950 opacity-100" />

            <div class="relative z-10">
              <Quote
                class="absolute top-0 right-0 w-8 h-8 text-stone-700/50 group-hover:text-stone-600 transition-colors"
              />

              <div class="flex gap-1 mb-6">
                <Star v-for="i in 5" :key="i" class="w-4 h-4 fill-amber-500 text-amber-500" />
              </div>

              <p class="text-stone-300 mb-8 leading-relaxed">"{{ testimonial.content }}"</p>

              <div class="flex items-center gap-4">
                <img
                  :src="testimonial.avatar"
                  :alt="testimonial.author"
                  class="w-10 h-10 rounded-full bg-stone-800 border border-stone-700"
                />
                <div>
                  <div class="font-bold text-sm text-stone-100">{{ testimonial.author }}</div>
                  <div class="text-xs text-stone-500">{{ testimonial.role }}</div>
                </div>
              </div>
            </div>
          </div>
        </LandingMarquee>

        <!-- Column 2 (Reverse) -->
        <LandingMarquee vertical reverse :duration="50" class="hidden md:flex h-full">
          <div
            v-for="(testimonial, index) in secondColumn"
            :key="index"
            class="bg-stone-900 border border-stone-800 p-8 rounded-3xl relative overflow-hidden group shadow-lg"
          >
            <div class="absolute inset-0 bg-linear-to-br from-stone-800 to-stone-950 opacity-100" />

            <div class="relative z-10">
              <Quote
                class="absolute top-0 right-0 w-8 h-8 text-stone-700/50 group-hover:text-stone-600 transition-colors"
              />

              <div class="flex gap-1 mb-6">
                <Star v-for="i in 5" :key="i" class="w-4 h-4 fill-amber-500 text-amber-500" />
              </div>

              <p class="text-stone-300 mb-8 leading-relaxed">"{{ testimonial.content }}"</p>

              <div class="flex items-center gap-4">
                <img
                  :src="testimonial.avatar"
                  :alt="testimonial.author"
                  class="w-10 h-10 rounded-full bg-stone-800 border border-stone-700"
                />
                <div>
                  <div class="font-bold text-sm text-stone-100">{{ testimonial.author }}</div>
                  <div class="text-xs text-stone-500">{{ testimonial.role }}</div>
                </div>
              </div>
            </div>
          </div>
        </LandingMarquee>

        <!-- Column 3 (Clone of 1 roughly for visual balance if needed, or split differently.
             Since we have 6 items, 2 cols is cleaner or 3 cols with 2 rows.
             User asked for "rows scroll vertically", likely columns.
             I'll stick to 3 columns visually by splitting differently or reusing logic)
        -->
        <LandingMarquee vertical :duration="45" class="hidden lg:flex h-full">
          <div
            v-for="(testimonial, index) in testimonials.slice(0, 3).reverse()"
            :key="index"
            class="bg-stone-900 border border-stone-800 p-8 rounded-3xl relative overflow-hidden group shadow-lg"
          >
            <div class="absolute inset-0 bg-linear-to-br from-stone-800 to-stone-950 opacity-100" />

            <div class="relative z-10">
              <Quote
                class="absolute top-0 right-0 w-8 h-8 text-stone-700/50 group-hover:text-stone-600 transition-colors"
              />

              <div class="flex gap-1 mb-6">
                <Star v-for="i in 5" :key="i" class="w-4 h-4 fill-amber-500 text-amber-500" />
              </div>

              <p class="text-stone-300 mb-8 leading-relaxed">"{{ testimonial.content }}"</p>

              <div class="flex items-center gap-4">
                <img
                  :src="testimonial.avatar"
                  :alt="testimonial.author"
                  class="w-10 h-10 rounded-full bg-stone-800 border border-stone-700"
                />
                <div>
                  <div class="font-bold text-sm text-stone-100">{{ testimonial.author }}</div>
                  <div class="text-xs text-stone-500">{{ testimonial.role }}</div>
                </div>
              </div>
            </div>
          </div>
        </LandingMarquee>
      </div>
    </div>
  </section>
</template>
