<script setup lang="ts">
import { ref } from 'vue'
import { Check } from 'lucide-vue-next'
import AnimatedUnderline from './AnimatedUnderline.vue'

const billingPeriod = ref<'monthly' | 'yearly'>('monthly')

const features = {
  starter: ['Up to 1,000 MAU', 'Basic OTA Updates', 'Community Support', '1 Member'],
  pro: [
    'Up to 10,000 MAU',
    'Advanced Analytics',
    'Priority Support',
    '5 Members',
    'Binary Diffing',
    'Rollback Protection',
  ],
  enterprise: [
    'Unlimited MAU',
    'Custom Contracts',
    'Dedicated Success Manager',
    'Unlimited Members',
    'SSO / SAML',
    'On-premise Option',
    'SLA Guarantee',
  ],
}

const plans = [
  {
    name: 'Starter',
    description: 'Perfect for indie developers and side projects.',
    price: { monthly: 0, yearly: 0 },
    features: features.starter,
    cta: 'Start for Free',
    highlight: false,
  },
  {
    name: 'Pro',
    description: 'For growing apps that need reliability and scale.',
    price: { monthly: 49, yearly: 39 }, // 39 * 12 = 468 billed yearly
    features: features.pro,
    cta: 'Start Free Trial',
    highlight: true,
  },
  {
    name: 'Enterprise',
    description: 'For large-scale applications with custom needs.',
    price: { monthly: 'Custom', yearly: 'Custom' },
    features: features.enterprise,
    cta: 'Contact Sales',
    highlight: false,
  },
]
</script>

<template>
  <section id="pricing" class="py-24 relative overflow-hidden">
    <!-- Background Gradients -->
    <div
      class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none"
    />

    <div class="max-w-7xl mx-auto px-6 relative z-10">
      <div class="text-center mb-16">
        <div
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900/50 text-stone-100 w-fit mx-auto mb-4"
        >
          <span class="text-sm font-semibold">Plans</span>
        </div>
        <h2 class="text-3xl md:text-5xl font-bold">
          <span class="noto-serif-display-300 font-thin italic relative">
            Simple, transparent
            <span class="absolute -bottom-2 left-0 right-0 z-0">
              <AnimatedUnderline />
            </span>
          </span>
          pricing
        </h2>
        <p class="text-muted-foreground text-lg max-w-2xl mx-auto my-8">
          Start for free and scale as you grow. No hidden fees.
        </p>

        <!-- Toggle -->
        <div class="flex items-center justify-center gap-4">
          <span
            class="text-sm font-medium"
            :class="billingPeriod === 'monthly' ? 'text-white' : 'text-stone-400'"
            >Monthly</span
          >
          <button
            @click="billingPeriod = billingPeriod === 'monthly' ? 'yearly' : 'monthly'"
            class="w-14 h-7 bg-stone-800 rounded-full p-1 transition-colors relative"
            :class="{ 'bg-primary/20': billingPeriod === 'yearly' }"
          >
            <div
              class="w-5 h-5 bg-primary rounded-full shadow-md transition-transform duration-300"
              :class="billingPeriod === 'yearly' ? 'translate-x-7' : 'translate-x-0'"
            />
          </button>
          <span
            class="text-sm font-medium"
            :class="billingPeriod === 'yearly' ? 'text-white' : 'text-stone-400'"
          >
            Yearly <span class="text-primary text-xs ml-1 font-bold">-20%</span>
          </span>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        <div
          v-for="plan in plans"
          :key="plan.name"
          class="relative p-8 rounded-3xl border transition-all duration-300 flex flex-col h-full bg-stone-900 overflow-hidden group"
          :class="[
            plan.highlight
              ? 'border-primary shadow-2xl shadow-primary/20 scale-105 z-10'
              : 'border-stone-800 hover:border-stone-700',
          ]"
        >
          <!-- Bento Gradient -->
          <div class="absolute inset-0 bg-linear-to-br from-stone-800 to-stone-950 opacity-100" />

          <!-- Glow Edge -->
          <div
            class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-stone-500 to-transparent opacity-50"
          />

          <div class="relative z-10 flex flex-col h-full">
            <!-- Popular Badge -->
            <div
              v-if="plan.highlight"
              class="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-full shadow-lg"
            >
              Most Popular
            </div>

            <div class="mb-8 relative z-10">
              <h3 class="text-xl font-bold mb-2 text-white">{{ plan.name }}</h3>
              <p class="text-sm text-stone-300 min-h-[40px]">{{ plan.description }}</p>
            </div>

            <div class="mb-8">
              <div class="flex items-baseline gap-1">
                <span class="text-4xl text-foreground font-bold">
                  {{ typeof plan.price[billingPeriod] === 'number' ? '$' : ''
                  }}{{ plan.price[billingPeriod] }}
                </span>
                <span v-if="typeof plan.price[billingPeriod] === 'number'" class="text-stone-500"
                  >/mo</span
                >
              </div>
              <div
                v-if="billingPeriod === 'yearly' && typeof plan.price.yearly === 'number'"
                class="text-xs text-stone-500 mt-1"
              >
                Billed ${{ plan.price.yearly * 12 }} yearly
              </div>
            </div>

            <ul class="space-y-4 mb-8 flex-1 relative z-10">
              <li v-for="feature in plan.features" :key="feature" class="flex items-start gap-3">
                <Check class="w-5 h-5 text-primary shrink-0" />
                <span class="text-sm text-stone-200">{{ feature }}</span>
              </li>
            </ul>

            <button
              class="w-full py-3 rounded-xl font-bold text-sm transition-all relative z-10"
              :class="[
                plan.highlight
                  ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20'
                  : 'bg-stone-800 text-white hover:bg-stone-700 border border-stone-700',
              ]"
            >
              {{ plan.cta }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
