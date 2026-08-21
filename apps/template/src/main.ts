import { notifyAppReady } from "@capuchoo/updater";
import Framework7 from "framework7/lite-bundle";
import Framework7Vue from "framework7-vue";

import App from "./App.vue";

import "./assets/css/icons.css";
import "./assets/css/app.css";
import { notificationsPlugin } from "./plugins/notifications.plugin";

import { vueQueryPlugin } from "./plugins/vue-query.plugin";

// Tell the OTA plugin this bundle booted, before anything that can block.
//
// @capgo/capacitor-updater starts a timer (appReadyTimeout, 10s) when a new
// bundle loads and rolls back to the previous one if it never hears this. The
// app used to call it from inside the updater's init, *after* awaiting a network
// request to the backend - and skipped it entirely whenever a native update was
// pending. A slow connection, or any pending native update, therefore silently
// reverted a bundle that had installed perfectly well.
//
// Not awaited on purpose: this must not delay mounting.
void notifyAppReady();

Framework7.use(Framework7Vue);

const app = createApp(App);

app.use(vueQueryPlugin);
app.use(piniaPlugin);
app.use(i18nPlugin);
await openreplayPlugin(app);
await notificationsPlugin(app);

app.mount("#app");
