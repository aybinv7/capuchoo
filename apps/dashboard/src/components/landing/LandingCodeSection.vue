<script setup lang="ts">
import { CheckCircle } from 'lucide-vue-next'
import AnimatedUnderline from './AnimatedUnderline.vue'

const steps = [
  { number: 1, label: 'Install the SDK', active: true },
  { number: 2, label: 'Configure your app keys', active: false },
  { number: 3, label: 'Push to deploy', active: false },
]

const terminalLines = [
  { type: 'command', text: 'capucho deploy' },
  { type: 'output', text: 'Building bundle...', time: '420ms' },
  { type: 'output', text: 'Optimizing assets...', time: '120ms' },
  { type: 'output', text: 'Signing package...', time: '85ms' },
  { type: 'success', text: 'Deployment v2.4.1 is live' },
]
</script>

<template>
  <section class="py-24 px-6 bg-stone-900 text-stone-300 overflow-hidden relative">
    <!-- Background Blob -->
    <div
      class="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 blur-[100px] rounded-full pointer-events-none animate-pulse"
    />

    <div class="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-16 relative z-10">
      <!-- Left: Content -->
      <div class="flex-1 space-y-8">
        <h2 class="font-serif text-3xl md:text-4xl text-white tracking-tight">
          <span class="noto-serif-display-300 font-thin italic relative">
            Developer Experience
            <span class="absolute -bottom-2 left-0 right-0 z-0">
              <AnimatedUnderline />
            </span>
          </span>
          First
        </h2>
        <p class="text-stone-400 leading-relaxed text-lg">
          Capucho integrates directly into your CI/CD pipeline. No drag-and-drop required. Just
          standard CLI commands you already know.
        </p>

        <!-- Steps -->
        <div class="space-y-4">
          <div
            v-for="step in steps"
            :key="step.number"
            class="flex items-center gap-4 group cursor-pointer"
          >
            <div
              :class="[
                'w-8 h-8 rounded-full flex items-center justify-center border transition-colors',
                step.active
                  ? 'bg-primary/20 text-primary border-primary/30 group-hover:bg-primary group-hover:text-white'
                  : 'bg-stone-800 text-stone-500 border-stone-700 group-hover:border-primary/50 group-hover:text-stone-300',
              ]"
            >
              {{ step.number }}
            </div>
            <span :class="step.active ? 'text-stone-200 font-medium' : 'text-stone-400'">
              {{ step.label }}
            </span>
          </div>
          <!-- Connector lines -->
          <div
            v-for="i in 2"
            :key="'line-' + i"
            class="h-8 w-0.5 bg-stone-800 ml-4 -my-4"
            style="position: relative; top: -2rem"
          />
        </div>
      </div>

      <!-- Right: Terminal -->
      <div class="flex-1 w-full max-w-lg">
        <div
          class="rounded-xl overflow-hidden bg-[#0c0c0c] border border-stone-800 shadow-2xl font-mono text-sm relative hover:scale-[1.02] transition-transform duration-300"
        >
          <!-- Window Controls -->
          <div class="h-10 bg-[#161616] border-b border-stone-800 flex items-center px-4 gap-2">
            <div class="w-3 h-3 rounded-full bg-red-500/80" />
            <div class="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div class="w-3 h-3 rounded-full bg-green-500/80" />
            <span class="ml-auto text-xs text-stone-600">terminal</span>
          </div>

          <!-- Content -->
          <div class="p-6 space-y-4">
            <!-- Command -->
            <div class="flex gap-2">
              <span class="text-primary font-bold">➜</span>
              <span class="text-stone-100">capucho deploy</span>
            </div>

            <!-- Output -->
            <div class="pl-4 border-l border-stone-800 space-y-2 text-xs md:text-sm">
              <div
                v-for="(line, index) in terminalLines.filter((l) => l.type === 'output')"
                :key="index"
                class="flex justify-between text-stone-400"
              >
                <span>{{ line.text }}</span>
                <span class="text-stone-600">{{ line.time }}</span>
              </div>
            </div>

            <!-- Success -->
            <div
              class="p-3 rounded bg-stone-900/50 border border-stone-800 text-emerald-400 flex items-center gap-2"
            >
              <CheckCircle class="w-4 h-4" />
              Deployment v2.4.1 is live
            </div>

            <!-- Cursor -->
            <div class="flex gap-2 animate-pulse">
              <span class="text-primary font-bold">➜</span>
              <span class="w-2 h-5 bg-stone-600 inline-block align-middle" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
