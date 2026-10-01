import Framework7 from "framework7/lite-bundle";
import Framework7Vue from "framework7-vue";

import "framework7/css/bundle";
import "./assets/css/icons.css";
import "./assets/css/app.css";

import App from "./App.vue";
import { i18n } from "./plugins/i18n.plugin";
import { renderBootstrapError } from "./plugins/bootstrapError";
import { sqlitePlugin } from "./plugins/sqlite.plugin";
import { applyStoredColorScheme } from "./shared/composables/theme/useColorTheme";
import { restoreSession } from "./shared/session/session";

Framework7.use(Framework7Vue);

/**
 * The scheme is written before mount so the first frame is already in the chosen colours, the
 * database opens before mount so no screen renders against a missing schema, and the session is
 * restored so a signed-in person lands on their apps rather than the sign-in screen. A failure in
 * any of them takes the screen with a sentence and a retry, instead of an empty `#app`.
 */
async function bootstrap(): Promise<void> {
  try {
    applyStoredColorScheme();
    await sqlitePlugin();
    await restoreSession();
  } catch (error) {
    renderBootstrapError(error);
    return;
  }

  const app = createApp(App);
  app.use(i18n);
  app.mount("#app");
}

void bootstrap();
