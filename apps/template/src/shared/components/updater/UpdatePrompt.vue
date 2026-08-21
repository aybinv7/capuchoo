<template>
  <f7-popup
    :opened="visible"
    :close-on-backdrop-click="false"
    class="update-popup custom-popup-close"
  >
    <f7-page class="!pt-20">
      <div
        class="update-container display-flex flex-direction-column justify-content-center align-items-center height-100"
      >
        <div class="icon-wrapper !mt-10 margin-bottom">
          <f7-icon
            :f7="error ? 'exclamationmark_triangle_fill' : 'rocket_fill'"
            size="64"
            :class="error ? 'text-color-red' : 'text-color-primary'"
          ></f7-icon>
        </div>

        <f7-block-title large class="no-margin text-align-center">
          {{ title }}
        </f7-block-title>

        <div
          v-if="subtitle"
          class="text-color-gray margin-bottom text-align-center font-size-large"
        >
          {{ subtitle }}
        </div>

        <!--
          Rendered as text, never as HTML. Release notes come from the server,
          and this WebView has the native bridge attached - v-html here would
          let a release note run code with plugin access.
        -->
        <f7-block v-if="body" class="width-100 release-notes-block margin-top">
          <div
            class="release-notes-content padding bg-color-white text-color-black rounded-lg shadow-sm"
          >
            <p v-if="!error"><strong>What's new</strong></p>
            <div class="pre-wrap">{{ body }}</div>
          </div>
        </f7-block>

        <div v-if="showProgress" class="width-100 padding-horizontal margin-vertical">
          <f7-progressbar
            :progress="progress.percent"
            class="height-8 rounded-full"
          ></f7-progressbar>
          <div class="text-align-center margin-top-half text-color-gray">
            {{ progress.percent }}% downloaded
          </div>
        </div>

        <div class="width-100 padding margin-top auto-margin-top buttons-container">
          <f7-button
            large
            fill
            round
            :loading="busy"
            :disabled="busy"
            class="margin-bottom"
            @click="primaryAction"
          >
            {{ primaryLabel }}
          </f7-button>

          <f7-button
            v-if="dismissible"
            large
            round
            color="gray"
            class="margin-top"
            @click="dismiss"
          >
            Remind me later
          </f7-button>

          <div
            v-if="isRequired"
            class="text-align-center text-color-red margin-top-half font-size-small"
          >
            <f7-icon f7="exclamationmark_circle_fill" size="14"></f7-icon>
            This update is required.
          </div>
        </div>
      </div>
    </f7-page>
  </f7-popup>
</template>

<script setup lang="ts">
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { useUpdatePrompt } from "@capuchoo/updater/vue";
import { onBeforeUnmount, onMounted } from "vue";

/**
 * All of the state and the decisions come from `useUpdatePrompt` in
 * @capuchoo/updater. This file is only the Framework7 markup, which is why the
 * package does not try to ship a component: the next app's design system is
 * not this one.
 */
const {
  visible,
  title,
  subtitle,
  body,
  primaryLabel,
  primaryAction,
  busy,
  dismissible,
  showProgress,
  progress,
  isRequired,
  error,
  dismiss,
} = useUpdatePrompt();

let backButton: PluginListenerHandle | null = null;

onMounted(async () => {
  backButton = await App.addListener("backButton", () => {
    // `dismiss` already refuses when the update is required or in flight, so
    // the back button cannot be used to escape a required update.
    void dismiss();
  });
});

// The old version added this listener and never removed it, so every remount
// stacked another one.
onBeforeUnmount(async () => {
  await backButton?.remove();
  backButton = null;
});
</script>

<style scoped>
.update-popup {
  z-index: 13500 !important;
}

.icon-wrapper {
  background: var(--f7-theme-color-opacity-10, rgba(var(--f7-theme-color-rgb), 0.1));
  padding: 24px;
  border-radius: 50%;
  animation: bounce 2s infinite;
}

.release-notes-block {
  max-width: 500px;
}

.release-notes-content {
  max-height: 200px;
  overflow-y: auto;
}

.buttons-container {
  max-width: 400px;
}

.pre-wrap {
  white-space: pre-wrap;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .icon-wrapper {
    animation: none;
  }
}

:root.dark .release-notes-content {
  background-color: #1c1c1d;
  color: white;
}
</style>
