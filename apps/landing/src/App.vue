<script setup lang="ts">
import ScrollToTop from "@/components/layout/ScrollToTop.vue";
import SiteFooter from "@/components/layout/SiteFooter.vue";
import SiteNav from "@/components/layout/SiteNav.vue";
import CanvasPreviewSection from "@/components/sections/CanvasPreviewSection.vue";
import ChannelsSection from "@/components/sections/ChannelsSection.vue";
import CliSection from "@/components/sections/CliSection.vue";
import CtaSection from "@/components/sections/CtaSection.vue";
import FaqSection from "@/components/sections/FaqSection.vue";
import FeaturesSection from "@/components/sections/FeaturesSection.vue";
import HeroSection from "@/components/sections/HeroSection.vue";
import HowItWorksSection from "@/components/sections/HowItWorksSection.vue";
import IntegrationsSection from "@/components/sections/IntegrationsSection.vue";
import SelfHostSection from "@/components/sections/SelfHostSection.vue";
import StoreWaitSection from "@/components/sections/StoreWaitSection.vue";
</script>

<template>
  <a
    href="#main"
    class="bg-primary text-primary-foreground sr-only z-50 rounded-md px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >Skip to content</a
  >
  <SiteNav />
  <main id="main">
    <HeroSection />
    <StoreWaitSection />
    <HowItWorksSection />
    <ChannelsSection />
    <FeaturesSection />
    <CliSection />
    <CanvasPreviewSection />
    <IntegrationsSection />
    <SelfHostSection />
    <FaqSection />
    <CtaSection />
  </main>
  <SiteFooter />
  <ScrollToTop />
</template>
