import { defineStore } from "pinia";
import { ref } from "vue";

export type LiveStatus = "idle" | "connecting" | "live" | "reconnecting" | "offline";

/** Connection state of the app's event stream, shown in the shell and on the canvas. */
export const useLiveStore = defineStore("live", () => {
  const status = ref<LiveStatus>("idle");
  const lastEventAt = ref<number | null>(null);
  const retryAt = ref<number | null>(null);

  function mark(next: LiveStatus, retry: number | null = null) {
    status.value = next;
    retryAt.value = retry;
  }

  function touch() {
    lastEventAt.value = Date.now();
  }

  return { status, lastEventAt, retryAt, mark, touch };
});
