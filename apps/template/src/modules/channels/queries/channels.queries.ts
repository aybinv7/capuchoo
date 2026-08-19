import { useApiQuery } from "@/shared/composables/api/useApiQuery";
import { useApiMutation } from "@/shared/composables/api/useApiMutation";
import { apiClient } from "@/shared/services/api.client";
import { type MaybeRefOrGetter, toValue, computed } from "vue";

export const CHANNELS_KEY = "channels";

export function useChannelsQuery(appId: MaybeRefOrGetter<string | undefined>) {
  return useApiQuery<any[]>(
    computed(() => [CHANNELS_KEY, toValue(appId)]),
    computed(() => `/dashboard/channels?app_id=${toValue(appId)}`),
    {
      enabled: computed(() => !!toValue(appId)),
    },
  );
}

export function useCreateChannelMutation() {
  return useApiMutation<any, any>("/dashboard/channels", "post");
}

export function useUpdateChannelMutation() {
  return useApiMutation<any, { id: string; data: any }>("");
}

export function useDeleteChannelMutation() {
  return useApiMutation<void, string>("");
}

// Custom mutation function for Update since it needs a dynamic ID
export function updateChannel(id: string, data: any) {
  return apiClient.put(`/dashboard/channels/${id}`, data);
}

// Custom mutation function for Delete since it needs a dynamic ID
export function deleteChannel(id: string) {
  return apiClient.delete(`/dashboard/channels/${id}`);
}
