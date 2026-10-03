import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { notifyError } from "@/shared/lib/notify";
import {
  deleteRule,
  fetchDevicePolicy,
  fetchRules,
  saveRule,
  type RuleWrite,
} from "../services/recordings.service";

export function useRecordingRules(appId: MaybeRefOrGetter<string>) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: computed(() => queryKeys.recordingRules(toValue(appId))),
    queryFn: ({ signal }) => fetchRules(toValue(appId), signal),
    enabled: computed(() => Boolean(toValue(appId))),
  });

  const refresh = () =>
    client.invalidateQueries({ queryKey: queryKeys.recordingRules(toValue(appId)) });

  const save = useMutation({
    mutationFn: (write: RuleWrite) => saveRule(toValue(appId), write),
    onSuccess: refresh,
    onError: notifyError,
  });

  const remove = useMutation({
    mutationFn: (ruleId: string) => deleteRule(ruleId),
    onSuccess: refresh,
    onError: notifyError,
  });

  return { query, save, remove };
}

export function useDevicePolicy(
  appId: MaybeRefOrGetter<string>,
  deviceId: MaybeRefOrGetter<string | null>,
) {
  return useQuery({
    queryKey: computed(() => queryKeys.devicePolicy(toValue(appId), toValue(deviceId) ?? "")),
    queryFn: ({ signal }) => fetchDevicePolicy(toValue(deviceId)!, signal),
    enabled: computed(() => Boolean(toValue(appId) && toValue(deviceId))),
  });
}
