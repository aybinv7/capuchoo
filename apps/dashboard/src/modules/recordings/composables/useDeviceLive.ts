import { computed, onScopeDispose, toValue, type MaybeRefOrGetter } from "vue";
import { useNow } from "@/shared/composables/useNow";
import { useRecordingRules } from "./useRecordingRules";

/** Minutes a device can be put live for. */
export const LIVE_DURATIONS = [5, 15, 30, 60] as const;

/** Whether a device's rule has it streaming, and the switch that starts or ends it. */
export function useDeviceLive(
  appId: MaybeRefOrGetter<string>,
  deviceId: MaybeRefOrGetter<string | null>,
) {
  const { query, save } = useRecordingRules(appId);
  const clock = useNow();
  onScopeDispose(clock.release);

  const rule = computed(() => {
    const device = toValue(deviceId);
    if (!device) return null;
    return (
      query.data.value?.rules.find(
        (candidate) => candidate.scope === "device" && candidate.device_uuid === device,
      ) ?? null
    );
  });

  /** When the live window ends, while it is open. */
  const liveUntil = computed(() => {
    const until = rule.value?.live_until;
    return until && new Date(until).getTime() > clock.now.value ? until : null;
  });

  function goLive(minutes: number | null) {
    const device = toValue(deviceId);
    if (!device) return;
    save.mutate({ scope: "device", deviceId: device, liveMinutes: minutes });
  }

  return { liveUntil, goLive, pending: save.isPending };
}
