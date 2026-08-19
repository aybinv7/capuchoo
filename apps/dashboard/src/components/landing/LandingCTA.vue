<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import { ArrowRight } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const router = useRouter()
const terminalLines = ref([
  { text: 'capucho deploy --target=production', type: 'command' },
  { text: 'Analyzing bundle...', type: 'output', delay: 500 },
  { text: 'Diffing binary...', type: 'output', delay: 1200 },
  { text: 'Optimizing assets...', type: 'output', delay: 1800 },
  { text: 'Uploading patch (14kb)...', type: 'output', delay: 2400 },
  { text: 'Update published successfully! 🚀', type: 'success', delay: 3200 },
])

const visibleLines = ref<any[]>([])
const isInteractive = ref(false)
const userInput = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const terminalBodyRef = ref<HTMLDivElement | null>(null)

// Conversation State
type InteractionState = 'idle' | 'awaiting_email' | 'awaiting_message'
const interactionState = ref<InteractionState>('idle')
const contactData = ref({ email: '', message: '' })

const promptLabel = computed(() => {
  switch (interactionState.value) {
    case 'awaiting_email':
      return 'Email:'
    case 'awaiting_message':
      return 'Message:'
    default:
      return '$'
  }
})

const scrollToBottom = async () => {
  await nextTick()
  if (terminalBodyRef.value) {
    terminalBodyRef.value.scrollTop = terminalBodyRef.value.scrollHeight
  }
}

const focusInput = () => {
  if (isInteractive.value && inputRef.value) {
    inputRef.value.focus()
  }
}

const handleCommand = () => {
  const input = userInput.value.trim()
  if (!input && interactionState.value === 'idle') return

  // Echo user input
  visibleLines.value.push({
    text: input,
    type: 'command',
    prompt: promptLabel.value,
  })
  userInput.value = ''
  scrollToBottom()

  // State Machine
  if (interactionState.value === 'idle') {
    if (input === 'contact') {
      interactionState.value = 'awaiting_email'
      visibleLines.value.push({ text: 'Please enter your email address:', type: 'output' })
    } else if (input === 'help') {
      visibleLines.value.push({ text: 'Available commands: contact, clear, help', type: 'output' })
    } else if (input === 'clear') {
      visibleLines.value = []
    } else {
      visibleLines.value.push({
        text: `command not found: ${input}. Try 'contact'.`,
        type: 'warning',
      })
    }
  } else if (interactionState.value === 'awaiting_email') {
    if (input.includes('@')) {
      contactData.value.email = input
      interactionState.value = 'awaiting_message'
      visibleLines.value.push({ text: "Great! What's your message?", type: 'output' })
    } else {
      visibleLines.value.push({
        text: "Invalid email. Please try again or type 'cancel'.",
        type: 'warning',
      })
      if (input === 'cancel') {
        interactionState.value = 'idle'
        visibleLines.value.push({ text: 'Cancelled.', type: 'output' })
      }
    }
  } else if (interactionState.value === 'awaiting_message') {
    contactData.value.message = input
    visibleLines.value.push({ text: 'Sending your message...', type: 'output' })

    // Simulate API call
    setTimeout(() => {
      visibleLines.value.push({
        text: "Message sent successfully! We'll be in touch.",
        type: 'success',
      })
      interactionState.value = 'idle'
      contactData.value = { email: '', message: '' }
      scrollToBottom()
    }, 1000)
  }

  scrollToBottom()
}

const startAnimation = () => {
  visibleLines.value = []
  isInteractive.value = false

  let delay = 0
  terminalLines.value.forEach((line) => {
    setTimeout(
      () => {
        visibleLines.value.push(line)
        scrollToBottom()
        if (line === terminalLines.value[terminalLines.value.length - 1]) {
          // Animation done, switch to interactive
          setTimeout(() => {
            visibleLines.value.push({ text: '', type: 'separator' })
            visibleLines.value.push({
              text: "Type 'contact' to send us a message.",
              type: 'output',
            })
            isInteractive.value = true
            scrollToBottom()
          }, 1000)
        }
      },
      delay + (line.delay || 0),
    )
    delay += (line.delay || 0) + 500
  })
}

onMounted(() => {
  startAnimation()
})
</script>

<template>
  <section class="py-24 relative overflow-hidden bg-stone-950">
    <!-- Background Grid -->
    <div
      class="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"
    />

    <!-- Glow Effect -->
    <div
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-primary/20 blur-[130px] rounded-full pointer-events-none opacity-50"
    />

    <div class="mx-auto max-w-7xl px-6 relative z-10">
      <div
        class="rounded-[2.5rem] border border-stone-800 bg-stone-900/50 backdrop-blur-xl overflow-hidden shadow-2xl relative"
      >
        <div
          class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-stone-500 to-transparent opacity-50"
        />

        <div class="flex flex-col lg:flex-row items-center gap-12 p-8 md:p-16">
          <!-- Text Content -->
          <div class="flex-1 text-center lg:text-left space-y-8">
            <h2
              class="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight"
            >
              Ready to <span class="text-primary">ship</span> your next update?
            </h2>
            <p class="text-xl text-stone-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Stop waiting for app store reviews. Push updates instantly to your users with a single
              command.
            </p>

            <div
              class="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start"
            >
              <Button
                size="lg"
                class="h-14 px-8 rounded-full text-base font-bold shadow-lg shadow-primary/25 hover:scale-105 transition-all duration-300"
                @click="router.push('/auth/login')"
              >
                Start Shipping Free
                <ArrowRight class="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                class="h-14 px-8 rounded-full text-base border-stone-700 hover:bg-stone-800 hover:text-white"
                @click="router.push('/docs')"
              >
                Read Documentation
              </Button>
            </div>

            <p class="text-sm text-stone-500">No credit card required for hobby apps.</p>
          </div>

          <!-- Terminal Mockup -->
          <div class="flex-1 w-full max-w-lg lg:max-w-xl relative group">
            <!-- Decorarive Glow behind terminal -->
            <div
              class="absolute -inset-1 bg-gradient-to-r from-primary/50 to-indigo-500/50 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"
            />

            <div
              class="bg-[#0c0c0c] border border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[320px] relative z-10"
            >
              <!-- Terminal Header -->
              <div
                class="flex items-center gap-2 px-4 py-3 border-b border-stone-800 bg-stone-900/50"
              >
                <div class="flex gap-2">
                  <div class="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div class="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50" />
                  <div class="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                </div>
                <div class="flex-1 text-center text-xs text-stone-500 font-mono">
                  capucho-cli — zsh
                </div>
              </div>

              <!-- Terminal Body -->
              <div
                ref="terminalBodyRef"
                class="p-6 font-mono text-sm space-y-3 overflow-y-auto custom-scrollbar flex-1"
                @click="focusInput"
              >
                <!-- Initial Animation Lines -->
                <div v-for="(line, index) in visibleLines" :key="index" class="flex gap-3">
                  <div v-if="line.type === 'command'" class="text-stone-500 select-none shrink-0">
                    {{ line.prompt || '$' }}
                  </div>
                  <div
                    :class="{
                      'text-stone-300': line.type === 'command',
                      'text-stone-400': line.type === 'output',
                      'text-green-400 font-bold': line.type === 'success',
                      'text-amber-400': line.type === 'warning',
                    }"
                  >
                    {{ line.text }}
                  </div>
                </div>

                <!-- Interactive Input Area -->
                <div v-if="isInteractive" class="flex gap-3 items-center">
                  <div class="text-stone-500 select-none shrink-0">{{ promptLabel }}</div>
                  <input
                    ref="inputRef"
                    v-model="userInput"
                    type="text"
                    class="bg-transparent border-none outline-none text-stone-300 w-full p-0 font-mono caret-primary focus:ring-0"
                    placeholder=""
                    @keydown.enter="handleCommand"
                    autocomplete="off"
                    spellcheck="false"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 2px;
}
</style>
