<script setup lang="ts">
import { type PropType } from 'vue'
import {
  Github,
  MessageSquare,
  AlertCircle,
  BarChart2,
  GitBranch,
  Slack,
  Database,
  Cloud,
  Terminal,
  Globe,
  Cpu,
  Layers,
} from 'lucide-vue-next'
import AnimatedUnderline from './AnimatedUnderline.vue'

const row1 = [
  { name: 'GitHub', icon: Github },
  { name: 'GitLab', icon: GitBranch },
  { name: 'Slack', icon: Slack },
  { name: 'Sentry', icon: AlertCircle },
  { name: 'Datadog', icon: BarChart2 },
  { name: 'Discord', icon: MessageSquare },
]

const row2 = [
  { name: 'Postgres', icon: Database },
  { name: 'Cloudflare', icon: Cloud },
  { name: 'Terminal', icon: Terminal },
  { name: 'Vercel', icon: Globe },
  { name: 'AWS', icon: Cpu },
  { name: 'Docker', icon: Layers },
]

// Duplicate arrays for seamless infinite scroll
const marqueeRow1 = [...row1, ...row1]
const marqueeRow2 = [...row2, ...row2]

// --- Internal Reusable Component ---
const IntegrationPill = defineComponent({
  props: {
    name: { type: String, required: true },
    icon: { type: Function as PropType<any>, required: true },
  },
  setup(props) {
    return () =>
      h(
        'div',
        {
          class:
            'flex items-center gap-3 md:px-6 md:py-3 px-4 py-2 rounded-2xl bg-stone-900 border border-stone-800 text-stone-50 hover:shadow-xl hover:scale-105 hover:bg-stone-800 transition-all duration-300 cursor-pointer relative overflow-hidden group/card',
        },
        [
          // Hover Gradient
          h('div', {
            class:
              'absolute inset-0 bg-linear-to-br from-stone-800 to-stone-950 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500',
          }),
          // Content
          h('div', { class: 'relative z-10 flex items-center gap-2 md:gap-3' }, [
            h(props.icon, { class: 'md:w-5 md:h-5 w-4 h-4 text-white' }),
            h('span', { class: 'md:text-sm text-xs font-medium' }, props.name),
          ]),
        ],
      )
  },
})
</script>

<template>
  <section
    id="integrations"
    class="py-24 px-6 relative bg-background border-y border-border overflow-hidden"
  >
    <div class="max-w-7xl mx-auto text-center mb-16">
      <div
        class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900/50 text-stone-100 w-fit mx-auto mb-4"
      >
        <span class="text-sm font-semibold">Ecosystem</span>
      </div>
      <h2 class="text-3xl font-bold">
        Works with your
        <span class="noto-serif-display-300 font-thin italic relative">
          favorite tools
          <span class="absolute -bottom-2 left-0 right-0 z-0">
            <AnimatedUnderline />
          </span>
        </span>
      </h2>
    </div>

    <!-- Row 1: Moving Left -->
    <div class="relative flex overflow-hidden group">
      <div class="flex animate-marquee gap-16 whitespace-nowrap py-2 md:py-4">
        <IntegrationPill
          v-for="(integration, index) in marqueeRow1"
          :key="`${integration.name}-${index}`"
          :name="integration.name"
          :icon="integration.icon"
        />
      </div>
      <div class="absolute inset-y-0 left-0 w-24 bg-linear-to-r from-background to-transparent" />
      <div class="absolute inset-y-0 right-0 w-24 bg-linear-to-l from-background to-transparent" />
    </div>

    <!-- Row 2: Moving Right -->
    <div class="relative flex overflow-hidden group mt-2 md:mt-4">
      <div class="flex animate-marquee-reverse gap-16 whitespace-nowrap py-2 md:py-4">
        <IntegrationPill
          v-for="(integration, index) in marqueeRow2"
          :key="`${integration.name}-${index}`"
          :name="integration.name"
          :icon="integration.icon"
        />
      </div>
      <div class="absolute inset-y-0 left-0 w-24 bg-linear-to-r from-background to-transparent" />
      <div class="absolute inset-y-0 right-0 w-24 bg-linear-to-l from-background to-transparent" />
    </div>
  </section>
</template>

<style scoped>
@keyframes marquee {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

@keyframes marquee-reverse {
  0% {
    transform: translateX(-50%);
  }
  100% {
    transform: translateX(0);
  }
}

.animate-marquee {
  animation: marquee 40s linear infinite;
}

.animate-marquee-reverse {
  animation: marquee-reverse 40s linear infinite;
}

/* Pause on hover for better UX */
.group:hover .animate-marquee,
.group:hover .animate-marquee-reverse {
  animation-play-state: paused;
}
</style>
