<script setup lang="ts">
import { Diff, ShieldCheck, BarChart3, History, Users, Lock } from 'lucide-vue-next'
import AnimatedUnderline from './AnimatedUnderline.vue'

const CardGlow = defineComponent({
  setup() {
    return () =>
      h('div', {
        class:
          'absolute -top-12 left-0 -translate-x-1/3 w-full h-40 bg-primary/30 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none',
      })
  },
})

const FeatureCard = defineComponent({
  props: {
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: [Object, Function] as PropType<Component>, required: true },
    className: { type: String, default: '' },
    index: { type: Number, default: 0 },
  },
  setup(props, { slots }) {
    return () =>
      h(
        Card,
        {
          class: `h-64 p-8 flex flex-col justify-between relative overflow-hidden bg-stone-900 text-stone-50 border-stone-800 group hover:shadow-xl transition-all duration-300 animate-scale-pop ${props.className}`,
          style: {
            'animation-delay': `${props.index * 0.2}s`,
          },
        },
        {
          default: () => [
            h('div', { class: 'absolute inset-0 bg-linear-to-br from-stone-800 to-stone-950' }),
            h(CardGlow),
            // Glow Edge
            h('div', {
              class:
                'absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-stone-500 to-transparent opacity-50',
            }),
            h(CardContent, { class: 'relative z-10 p-0' }, () => [
              h(
                'div',
                {
                  class: `w-12 h-12 bg-stone-800 rounded-2xl flex items-center justify-center shadow-inner mb-6 border border-stone-700 animate-float`,
                  style: {
                    'animation-delay': `${props.index * 0.2}s`,
                  },
                },
                [h(props.icon, { class: 'w-6 h-6 text-white' })],
              ),
              h(
                'h3',
                {
                  class: 'text-2xl font-semibold mb-2 text-white animate-slide-up',
                  style: {
                    'animation-delay': `${props.index * 0.2 + 0.1}s`,
                  },
                },
                [
                  (() => {
                    const spaceIndex = props.title.indexOf(' ')
                    if (spaceIndex === -1) {
                      // If no space, apply special font to the whole title
                      return h(
                        'span',
                        { class: 'noto-serif-display-300 font-thin italic' },
                        props.title,
                      )
                    }
                    return [
                      h('span', { class: 'font-sans' }, props.title.substring(0, spaceIndex)),
                      h(
                        'span',
                        { class: 'noto-serif-display-300 font-thin italic' },
                        props.title.substring(spaceIndex),
                      ),
                    ]
                  })(),
                ],
              ),
              h(
                'p',
                {
                  class: 'text-stone-400 text-sm max-w-sm animate-fade-in',
                  style: {
                    'animation-delay': `${props.index * 0.2 + 0.2}s`,
                  },
                },
                props.description,
              ),
            ]),
            slots.default ? slots.default() : null,
          ],
        },
      )
  },
})
</script>

<template>
  <section id="features" class="py-24 px-6 relative">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16">
        <div
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900/50 text-stone-100 w-fit mx-auto mb-4"
        >
          <span class="text-sm font-semibold">Core Capabilities</span>
        </div>
        <h2 class="text-3xl md:text-5xl font-bold">
          <span class="noto-serif-display-300 font-thin italic relative">
            Powerful features
            <span class="absolute -bottom-2 left-0 right-0 z-0">
              <AnimatedUnderline />
            </span>
          </span>
        </h2>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-3">
        <FeatureCard
          title="Differential Sync"
          description="We calculate the binary diff between versions, reducing download sizes by up to 90%."
          :icon="Diff"
          class-name="col-span-1 md:col-span-6 lg:col-span-8"
          :index="0"
        >
          <div
            class="absolute top-1/2 right-0 translate-x-1/4 -translate-y-1/2 opacity-50 group-hover:opacity-100 transition-all duration-500 group-hover:scale-110"
          >
            <div class="flex gap-2">
              <div class="w-16 h-32 bg-stone-700 rounded-lg" />
              <div
                class="w-16 h-32 bg-white/20 rounded-lg border-2 border-white/50 border-dashed"
              />
              <div class="w-16 h-32 bg-stone-500 rounded-lg" />
            </div>
          </div>
        </FeatureCard>

        <FeatureCard
          title="Signed & Secured"
          description="Every bundle is cryptographically signed."
          :icon="ShieldCheck"
          class-name="col-span-1 md:col-span-6 lg:col-span-4"
          :index="1"
        >
          <Lock
            class="absolute -bottom-8 -right-8 w-48 h-48 text-stone-800/50 transform rotate-12 group-hover:rotate-0 transition-transform"
          />
        </FeatureCard>

        <!-- Medium Card: Analytics -->
        <FeatureCard
          title="Real-time Insights"
          description="Monitor adoption rates instantly."
          :icon="BarChart3"
          class-name="col-span-1 md:col-span-6 lg:col-span-4"
          :index="2"
        >
          <div
            class="absolute bottom-4 right-4 w-24 h-24 opacity-20 group-hover:opacity-40 transition-all duration-500"
          >
            <div class="flex items-end gap-1 h-full">
              <div class="w-1/3 h-[40%] bg-white rounded-t-sm" />
              <div class="w-1/3 h-[70%] bg-stone-400 rounded-t-sm" />
              <div class="w-1/3 h-[50%] bg-stone-600 rounded-t-sm" />
            </div>
          </div>
        </FeatureCard>

        <FeatureCard
          title="Instant Rollback"
          description="Revert mistakes in milliseconds."
          :icon="History"
          class-name="col-span-1 md:col-span-6 lg:col-span-4"
          :index="3"
        >
          <div
            class="absolute -bottom-2 -right-2 w-24 h-24 border-4 border-stone-700 rounded-full opacity-20 group-hover:opacity-40 transition-all duration-500 group-hover:rotate-180"
          >
            <div
              class="absolute top-1/2 left-1/2 w-16 h-1 bg-stone-500 -translate-y-1/2 -translate-x-1/2 origin-left"
            />
          </div>
        </FeatureCard>

        <FeatureCard
          title="Granular Targeting"
          description="Deploy to specific OS versions or custom user cohorts."
          :icon="Users"
          class-name="col-span-1 md:col-span-12 lg:col-span-4"
          :index="4"
        >
          <div
            class="absolute bottom-6 right-6 flex -space-x-4 opacity-30 group-hover:opacity-50 transition-all duration-500"
          >
            <div class="w-12 h-12 rounded-full border-2 border-stone-800 bg-stone-600" />
            <div class="w-12 h-12 rounded-full border-2 border-stone-800 bg-stone-500" />
            <div class="w-12 h-12 rounded-full border-2 border-stone-800 bg-white" />
          </div>
        </FeatureCard>
      </div>
    </div>
  </section>
</template>

<style scoped>
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes slide-up {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(203, 213, 225, 0.2);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(203, 213, 225, 0);
  }
}

@keyframes scale-pop {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  70% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-float {
  animation: float 4s ease-in-out infinite;
}

.animate-slide-up {
  animation: slide-up 0.8s ease-out forwards;
}

.animate-fade-in {
  animation: fade-in 0.8s ease-out forwards;
}

.animate-scale-pop {
  animation: scale-pop 0.6s ease-out forwards;
}

.animate-pulse-glow {
  animation: pulse-glow 2s infinite;
}
</style>
