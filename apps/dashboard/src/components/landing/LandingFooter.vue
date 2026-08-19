<script setup lang="ts">
import { Layers } from 'lucide-vue-next'

const currentYear = new Date().getFullYear()

const footerLinks = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'Integrations', href: '#' },
    { label: 'Pricing', href: '#' },
  ],
  resources: [
    { label: 'Documentation', href: '/docs' },
    { label: 'API Reference', href: '/docs/api' },
    { label: 'Community', href: '#' },
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' },
  ],
}
</script>

<template>
  <footer class="bg-card pt-20 pb-10 px-6 border-t border-border">
    <div class="max-w-7xl mx-auto">
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-10 mb-16">
        <!-- Brand -->
        <div class="col-span-2 lg:col-span-2 space-y-6">
          <a href="/" class="flex items-center gap-2 group">
            <div class="w-6 h-6 bg-primary rounded-lg flex items-center justify-center">
              <Layers class="text-primary-foreground w-3 h-3" />
            </div>
            <span class="font-sans font-bold text-lg tracking-tight">Capucho</span>
          </a>
          <p class="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Redefining how developers ship. Faster iterations, safer deployments, and happier users.
          </p>
        </div>

        <!-- Product -->
        <div>
          <h4 class="font-semibold text-sm mb-4">Product</h4>
          <ul class="space-y-3 text-sm text-muted-foreground">
            <li v-for="link in footerLinks.product" :key="link.label">
              <a :href="link.href" class="hover:text-primary transition-colors">
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>

        <!-- Resources -->
        <div>
          <h4 class="font-semibold text-sm mb-4">Resources</h4>
          <ul class="space-y-3 text-sm text-muted-foreground">
            <li v-for="link in footerLinks.resources" :key="link.label">
              <a :href="link.href" class="hover:text-primary transition-colors">
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>

        <!-- Company -->
        <div>
          <h4 class="font-semibold text-sm mb-4">Company</h4>
          <ul class="space-y-3 text-sm text-muted-foreground">
            <li v-for="link in footerLinks.company" :key="link.label">
              <a :href="link.href" class="hover:text-primary transition-colors">
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div
        class="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4"
      >
        <div class="text-xs text-muted-foreground">
          © {{ currentYear }} Capucho Inc. All rights reserved.
        </div>
        <div class="flex gap-6 text-xs text-muted-foreground font-medium">
          <a href="/privacy" class="hover:text-foreground">Privacy Policy</a>
          <a href="/terms" class="hover:text-foreground">Terms of Service</a>
        </div>
      </div>
    </div>
  </footer>
</template>
