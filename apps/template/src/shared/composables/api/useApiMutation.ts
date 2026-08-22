import { apiClient } from "@/shared/services/api.client";
import { useMutation, type UseMutationOptions } from "@tanstack/vue-query";
import { queryErrorHandler } from "./error/query-error-handler";

export function useApiMutation<TData = unknown, TVariables = unknown>(
  url: string,
  method: "post" | "put" | "patch" | "delete" = "post",
  options?: UseMutationOptions<TData, Error, TVariables>,
) {
  const resolved = typeof options === "function" ? options() : options;

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      try {
        let response;
        switch (method) {
          case "post":
            response = await apiClient.post(url, variables);
            break;
          case "put":
            response = await apiClient.put(url, variables);
            break;
          case "patch":
            response = await apiClient.patch(url, variables);
            break;
          case "delete":
            response = await apiClient.delete(url);
            break;
          default:
            throw new Error(`Unsupported method: ${String(method)}`);
        }
        return response.data;
      } catch (error) {
        throw queryErrorHandler(error);
      }
    },
    ...resolved,
  });
}
