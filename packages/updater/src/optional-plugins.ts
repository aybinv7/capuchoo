/**
 * Plugins only the native-update path needs, reached through Capacitor's own
 * registry rather than through a module import.
 *
 * OTA updates need `@capgo/capacitor-updater` and nothing else. Downloading and
 * installing an APK additionally needs file transfer, filesystem, network and a
 * file opener - four packages an app that only ships web bundles should not have
 * to install.
 *
 * They cannot be plain dependencies: `cap sync` discovers plugins by reading the
 * *application's* `dependencies` and `devDependencies` - `getDependencies()` in
 * @capacitor/cli does not recurse - so a plugin pulled in transitively would
 * have its JavaScript installed and its native half never added to the Android
 * or iOS project. `capuchoo setup --native` adds them to the app instead.
 *
 * Two ways of loading them have now failed on a real device, and the reason the
 * third is different is worth writing down.
 *
 *  1. `await import("@capacitor/network")` as a literal. Statically analysable,
 *     so Rolldown fails the *build* of any app that has not installed it:
 *
 *       Rolldown failed to resolve import "@capacitor/local-notifications"
 *       from ".../@capuchoo/updater/dist/vue.js"
 *
 *     An OTA-only app had to install four native plugins it never calls, just
 *     to compile.
 *
 *  2. The same import through a variable, with `@vite-ignore`. That hides it
 *     from the bundler - and hiding it from the bundler hides it from module
 *     resolution too. The specifier survives into the browser, where nothing
 *     maps bare names, so every native download died on:
 *
 *       TypeError: Failed to resolve module specifier '@capacitor/network'
 *
 *     reported to the user as "@capacitor/network is not installed" while it
 *     was installed, synced, and listed by `cap sync`. Optional peers became
 *     unusable peers.
 *
 * `registerPlugin` resolves nothing. It is a proxy keyed by the plugin's
 * registered *name*, from `@capacitor/core`, which is already a hard peer, and
 * the native half is discovered by that name at run time. There is no import to
 * resolve, so there is nothing for a bundler to fail on and nothing for the
 * browser to look up. `Capacitor.isPluginAvailable` is what actually knows
 * whether a plugin is installed, so the "run this to add it" message is now
 * answered by the platform rather than inferred from an exception message.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

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
 * The registered name of each plugin, and the package that provides it.
 *
 * The name is the one the native class declares in its `@CapacitorPlugin`
 * annotation, not the npm package - `@capacitor/file-transfer` registers as
 * `FileTransfer`. Getting one wrong produces a proxy that is happy to be called
 * and rejects at the first call, so they are pinned by test.
 */
const PLUGINS = {
  fileTransfer: { name: "FileTransfer", package: "@capacitor/file-transfer" },
  filesystem: { name: "Filesystem", package: "@capacitor/filesystem" },
  network: { name: "Network", package: "@capacitor/network" },
  fileOpener: { name: "FileOpener", package: "@capawesome-team/capacitor-file-opener" },
} as const;

function load<T>(key: keyof typeof PLUGINS): T {
  const { name, package: pkg } = PLUGINS[key];
  if (!Capacitor.isPluginAvailable(name)) throw new MissingNativePluginsError(pkg);
  return registerPlugin<T>(name);
}

/**
 * `Directory.Cache`, without importing the enum that declares it.
 *
 * The enum is plain JavaScript in `@capacitor/filesystem`, so reaching it means
 * importing the package - the exact thing this file exists to avoid. The value
 * is part of the plugin's wire contract and is what the native side switches
 * on.
 */
const CACHE_DIRECTORY = "CACHE" as never;

type FilesystemModule = typeof import("@capacitor/filesystem");
type FileTransferModule = typeof import("@capacitor/file-transfer");
type NetworkModule = typeof import("@capacitor/network");
type FileOpenerModule = typeof import("@capawesome-team/capacitor-file-opener");

/**
 * The same shape the module namespaces had, so call sites read unchanged:
 * `const { Directory, Filesystem } = await nativePlugins.filesystem()`.
 */
export const nativePlugins = {
  filesystem: async (): Promise<{
    Filesystem: FilesystemModule["Filesystem"];
    Directory: { Cache: FilesystemModule["Directory"]["Cache"] };
  }> => ({
    Filesystem: load<FilesystemModule["Filesystem"]>("filesystem"),
    Directory: { Cache: CACHE_DIRECTORY },
  }),

  fileTransfer: async (): Promise<{ FileTransfer: FileTransferModule["FileTransfer"] }> => ({
    FileTransfer: load<FileTransferModule["FileTransfer"]>("fileTransfer"),
  }),

  network: async (): Promise<{ Network: NetworkModule["Network"] }> => ({
    Network: load<NetworkModule["Network"]>("network"),
  }),

  fileOpener: async (): Promise<{ FileOpener: FileOpenerModule["FileOpener"] }> => ({
    FileOpener: load<FileOpenerModule["FileOpener"]>("fileOpener"),
  }),
};
