import { QueryClient, VueQueryPlugin, type VueQueryPluginOptions } from "@tanstack/vue-query";
import type { App } from "vue";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 5 * 60 * 1000, // 5 minutes
      staleTime: 1 * 60 * 1000, // 1 minute
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      throwOnError: false,
    },
    mutations: {
      retry: 0,
      throwOnError: false,
    },
  },
});

export const vueQueryPlugin = {
  install: (app: App) => {
    const options: VueQueryPluginOptions = {
      queryClient,
    };
    app.use(VueQueryPlugin, options);
  },
};
