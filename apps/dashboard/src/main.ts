import { VueQueryPlugin } from "@tanstack/vue-query";
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import { installGuards } from "./app/guards";
import { createAppRouter } from "./app/router";
import { createQueryClient } from "./shared/api/query-client";
import "vue-sonner/style.css";
import "./assets/styles/main.css";

const queryClient = createQueryClient();
const router = createAppRouter();
installGuards(router, queryClient);

createApp(App).use(createPinia()).use(VueQueryPlugin, { queryClient }).use(router).mount("#app");
