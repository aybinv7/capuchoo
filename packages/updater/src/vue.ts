/**
 * Vue entry point. `vue` is an optional peer dependency, so importing this
 * subpath is what pulls it in.
 */

export { useUpdater, type UpdaterState } from "./vue/useUpdater.js";
export { useUpdatePrompt } from "./vue/useUpdatePrompt.js";
export { INSTALL_ABANDONED_MESSAGE } from "./vue/installer-handoff.js";
