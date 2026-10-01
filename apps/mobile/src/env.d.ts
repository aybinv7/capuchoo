/// <reference types="vite/client" />

/**
 * For the checkers that do not parse single-file components. `vue-tsc` resolves the real SFC and
 * ignores this; it exists so `vp check`'s type-aware pass can follow a `.vue` import instead of
 * reporting every one as a missing module.
 *
 * Safe here because every `.vue` import in this template is a lazily loaded route component, whose
 * props are never checked at the import site.
 */
declare module "*.vue" {
  import type { DefineComponent } from "vue";

  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

/** Icon font, imported for its side effect only. */
declare module "framework7-icons";

/** Injected by vite `define`; see vite.config.ts. */
declare const __APP_NAME__: string;
declare const __APP_VERSION__: string;

/**
 * The environment this app reads. Declared, so a typo in a variable name is a type error rather than
 * a silent `undefined` that falls back to the default and looks like the setting was ignored.
 *
 * The engine is `string`, not `StorageId`, because a `.env` is unchecked text: a union here would
 * claim a guarantee nothing enforces. `storage.config.ts` narrows it with `isStorageId` and reports
 * a value it does not recognise.
 *
 * See `.env.example` for what each value means.
 */
interface ImportMetaEnv {
  readonly VITE_STORAGE_ENGINE?: string;
  readonly VITE_PRAGMA_PROFILE?: "safe" | "fast";
  readonly VITE_DEFAULT_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
