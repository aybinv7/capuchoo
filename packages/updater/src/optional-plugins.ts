/**
 * Plugins only the native-update path needs, loaded when it runs.
 *
 * OTA updates need `@capgo/capacitor-updater` and nothing else. Downloading and
 * installing an APK additionally needs file transfer, filesystem, network and a
 * file opener - four packages an app that only ships web bundles should not have
 * to install.
 *
 * They are optional peers, imported here rather than at module load, so
 * importing this library does not require them. A missing one produces a message
 * naming what to install instead of `Cannot find module` from inside a bundler.
 *
 * They cannot be plain dependencies: `cap sync` discovers plugins by reading the
 * *application's* `dependencies` and `devDependencies` - `getDependencies()` in
 * @capacitor/cli does not recurse - so a plugin pulled in transitively would
 * have its JavaScript installed and its native half never added to the Android
 * or iOS project. `capuchoo setup --native` adds them to the app instead.
 */

const NATIVE_PACKAGES = [
  "@capacitor/file-transfer",
  "@capacitor/filesystem",
  "@capacitor/network",
  "@capawesome-team/capacitor-file-opener",
] as const;

export class MissingNativePluginsError extends Error {
  readonly packages: readonly string[];

  constructor(missing: string) {
    super(
      `Native updates need ${missing}, which is not installed. ` +
        `Run: npx capuchoo setup --native (adds ${NATIVE_PACKAGES.join(", ")} and runs cap sync). ` +
        "OTA updates do not need any of them.",
    );
    this.name = "MissingNativePluginsError";
    this.packages = NATIVE_PACKAGES;
  }
}

/**
 * Imports through a variable specifier, so a bundler cannot resolve it.
 *
 * `import("@capacitor/network")` written literally is statically analysable, and
 * Rolldown fails the *build* of any app that has not installed it:
 *
 *   Rolldown failed to resolve import "@capacitor/local-notifications"
 *   from ".../@capuchoo/updater/dist/vue.js"
 *
 * which defeats the entire point of an optional peer - an OTA-only app would
 * have to install four native plugins it never calls just to compile. Held in a
 * variable, resolution happens at runtime, where `load` already turns a miss
 * into a message naming what to install.
 */
async function importOptional<T>(specifier: string): Promise<T> {
  return (await import(/* @vite-ignore */ specifier)) as T;
}

async function load<T>(specifier: string, importer: () => Promise<T>): Promise<T> {
  try {
    return await importer();
  } catch (error) {
    // A genuine runtime failure inside the plugin should not be reported as a
    // missing install, so only a resolution failure is translated.
    const message = error instanceof Error ? error.message : String(error);
    if (/cannot find module|failed to resolve|module not found/i.test(message)) {
      throw new MissingNativePluginsError(specifier);
    }
    throw error;
  }
}

const optional =
  <T>(specifier: string) =>
  () =>
    load(specifier, () => importOptional<T>(specifier));

export const nativePlugins = {
  fileTransfer: optional<typeof import("@capacitor/file-transfer")>("@capacitor/file-transfer"),
  filesystem: optional<typeof import("@capacitor/filesystem")>("@capacitor/filesystem"),
  network: optional<typeof import("@capacitor/network")>("@capacitor/network"),
  fileOpener: optional<typeof import("@capawesome-team/capacitor-file-opener")>(
    "@capawesome-team/capacitor-file-opener",
  ),
};
