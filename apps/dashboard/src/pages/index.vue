<template>
  <div
    class="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary"
  >
    <LandingNav />
    <LandingHero />
    <LandingBentoFeatures id="features" />
    <LandingIntegrations id="integrations" />
    <LandingCodeSection id="code" />
    <LandingDashboardPreview id="dashboard" />
    <LandingTestimonials id="testimonials" />
    <LandingCollaboration id="collaboration" />
    <LandingStats />
    <LandingPricing id="pricing" />
    <LandingCTA />
    <LandingFooter />
    <ScrollToTop />
  </div>
</template>

<script setup lang="ts">
import LandingNav from '@/components/landing/LandingNav.vue'
import LandingHero from '@/components/landing/LandingHero.vue'
import LandingDashboardPreview from '@/components/landing/LandingDashboardPreview.vue'
import LandingBentoFeatures from '@/components/landing/LandingBentoFeatures.vue'
import LandingIntegrations from '@/components/landing/LandingIntegrations.vue'
import LandingCodeSection from '@/components/landing/LandingCodeSection.vue'
import LandingFooter from '@/components/landing/LandingFooter.vue'
import LandingStats from '@/components/landing/LandingStats.vue'
import LandingTestimonials from '@/components/landing/LandingTestimonials.vue'
import LandingPricing from '@/components/landing/LandingPricing.vue'
import LandingCollaboration from '@/components/landing/LandingCollaboration.vue'
import LandingCTA from '@/components/landing/LandingCTA.vue'
import ScrollToTop from '@/components/landing/ScrollToTop.vue'

definePage({
  meta: {
    title: 'Capucho - Intelligent Hybrid Deployment',
    description:
      'The atomic deployment engine for hybrid apps. OTA updates and native releases from a single dashboard.',
    category: 'home',
    layout: 'public',
  },
})
</script>
