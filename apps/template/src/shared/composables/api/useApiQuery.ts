import { apiClient } from "@/shared/services/api.client";
import { useQuery, type UseQueryOptions } from "@tanstack/vue-query";
import { unref, type MaybeRef } from "vue";
import { queryErrorHandler } from "./error/query-error-handler";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export function useApiQuery<TData = unknown>(
  queryKey: any,
  url: MaybeRef<string>,
  options?: Omit<UseQueryOptions<TData, Error, TData, any>, "queryKey" | "queryFn">,
) {
  const resolved = typeof options === "function" ? options() : options;

  return useQuery<TData, Error>({
    queryKey: queryKey as any,
    queryFn: async () => {
      try {
        const resolvedUrl = unref(url);
        const response = await apiClient.get(resolvedUrl);

        // Handle wrapper from API if present
        if (
          typeof response.data === "object" &&
          response.data !== null &&
          "data" in response.data
        ) {
          return (response.data as ApiResponse<TData>).data;
        }
        return response.data;
      } catch (error) {
        throw queryErrorHandler(error);
      }
    },
    ...resolved,
  });
}
