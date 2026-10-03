<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useBreadcrumbLabel } from "@/shared/layouts/composables/useBreadcrumbLabel";
import AssistSessionView from "../components/assist/AssistSessionView.vue";

const route = useRoute();
const deviceId = computed(() =>
  typeof route.params.deviceId === "string" ? route.params.deviceId : "",
);
const deviceName = computed(() =>
  typeof route.query.name === "string" && route.query.name ? route.query.name : "a device",
);
useBreadcrumbLabel(computed(() => `Assist · ${deviceName.value}`));

/** Each attempt is a new session; asking again starts one from scratch. */
const attempt = ref(0);
</script>

<template>
  <AssistSessionView
    v-if="deviceId"
    :key="`${deviceId}:${attempt}`"
    :device-id="deviceId"
    :device-name="deviceName"
    @again="attempt++"
  />
</template>
