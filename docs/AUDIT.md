# Audit

Everything found while merging the five Capucho repositories into one workspace, what it broke, and
what replaced it. Ordered by how much damage each item could do, not by where it lived.

A later pass over the backend and dashboard is in [BACKEND-AUDIT.md](./BACKEND-AUDIT.md) - it covers
why the dashboard never showed a single device or log row.

Two things need action from you and are not fixed by any commit here:

1. **Rotate the Supabase keys.** `capucho-back/.env` was committed with seven populated values,
   `SUPABASE_SERVICE_KEY` among them - a `service_role` key that bypasses row level security
   entirely. It is untracked here and replaced with `.env.example`, but the value is still in the
   history of `github.com/aybinv7/capucho-back`, and in this repository's own history via the
   `git subtree` import. Removing a file does not remove it from a pushed history.

   Rotate by migrating to Supabase's current keys, which retires the leaked pair in the same
   operation. See [SUPABASE-KEYS.md](./SUPABASE-KEYS.md) for the runbook. The step that actually
   ends the exposure is the last one: **creating new keys does not disable the old ones** - the
   legacy pair has to be deleted in the dashboard, or the leaked string stays valid.

2. **Delete `~/pnpm-workspace.yaml`, `~/package.json` and `~/node_modules`.** A
   `pnpm install claumport` was once run from your home directory. Every project under
   `C:\Users\aybin\` therefore looks like it sits inside a pnpm workspace - which is why `vp create`
   refused to scaffold anywhere below it.

---

## 1. The update loop could revert a bundle that had installed correctly

`apps/template` withheld `notifyAppReady()` whenever a native update was pending, and otherwise
called it only _after_ awaiting a network request. The code recorded its reasoning in a comment:

```
 * - Plugin's auto-update is blocked until notifyAppReady() is called
 * - We only call notifyAppReady() when no native update is pending
```

That is not what the call does. `notifyAppReady()` confirms that the bundle _currently running_
booted successfully. If `@capgo/capacitor-updater` does not hear it within `appReadyTimeout` (10 s),
it concludes the new bundle crashed and rolls back to the previous one.

So the app rolled back a perfectly good bundle whenever a native update happened to be available,
and whenever the network was slow enough for one request to eat ten seconds.

**Now:** `main.ts` calls `notifyAppReady()` as its first statement, before anything that can block,
and never conditionally.

## 2. The plugin and the app were both applying updates

`capacitor.config.ts` set `autoUpdate: true` while the app also called `download()` and `set()` from
JavaScript. The plugin applied bundles on its own schedule at the same time as the UI was managing
them, so a device could download the same bundle twice or reload mid-prompt.

The same config also allowed an empty `updateUrl`:

```ts
updateUrl: process.env.VITE_UPDATE_API_URL
  ? `${process.env.VITE_UPDATE_API_URL}/api/update`
  : "",
```

An empty URL does not fail. The plugin simply never checks for updates - a build shipped with
updates silently disabled.

**Now:** `capuchoUpdaterConfig()` in `@capuchoo/updater/capacitor` returns
`autoUpdate: "onlyDownload"` and throws if `apiUrl` is empty. Nine tests pin the behaviour.

## 3. `deploy native --type release` published unsigned APKs

`android/app/build.gradle` had no `signingConfig`. `assembleRelease` therefore succeeded and wrote
`app-release-unsigned.apk`, and the old `findApk` accepted any `.apk` in the variant directory - so
the CLI uploaded an unsigned artefact as a release. Android refuses to install one. The failure only
surfaced on a user's phone.

The GitHub workflow that was supposed to sign it could not: every signing step was gated on
`steps.env.outputs.deploy_target`, and no step had `id: env`, so those conditions were always false.

**Now:** `collectAndroidArtifact` inspects the artefact for a v1 (`META-INF/*.RSA`) or v2
(`APK Sig Block 42`) signature and refuses to publish an unsigned release unless `--allow-unsigned`
is passed. `build.gradle` has a real release `signingConfig` driven by `CAPUCHO_KEYSTORE_*`
environment variables.

## 4. The app asked the wrong endpoint about native updates

The template used two sources of truth:

- `GET /api/native-updates/check` for native updates
- `POST /api/update` for OTA

Only `/api/update` consults the channel's assigned native version and an OTA bundle's
`min_update_version` gate. Going around it meant a device could be told to install a web bundle its
binary was too old to run.

The OTA check also sent a constant:

```ts
version_name: "builtin", // Standard for checking against baseline
```

so the server always compared against `0.0.0` and re-served bundles the device already had.

**Now:** one request to `/api/update`, with the real current bundle version. `resolveUpdate()` in
`@capuchoo/core` narrows the response, and native outranks OTA because the server can legitimately
return both.

## 5. "Channel not found" was shown to users as "you are up to date"

A misconfigured channel, or a staging build pointed at a production channel, returns
`Channel not found` / `Environment mismatch`. The app treated any non-update response as "nothing to
do", so a broken channel could go unnoticed indefinitely.

**Now:** `isBlockingResponse()` separates the two. Configuration failures raise
`UpdateCheckBlockedError` and surface in the UI, and the CLI refuses a deploy whose channel
environment disagrees with the flavour's `VITE_APP_ID` _before_ uploading anything.

## 6. Release notes were injected as HTML into a privileged WebView

```vue
<div v-html="releaseNotes" class="pre-wrap"></div>
```

Release notes come from the server. This WebView has the Capacitor bridge attached, so anything
executing in it reaches native plugins - filesystem, network, the installer. A release note was a
script injection vector.

**Now:** interpolated as text.

## 7. Every deploy dirtied the working tree, and two deploys raced

`syncVersion` rewrote `VITE_APP_VERSION`, `VERSION_CODE` and `BUILD_NUMBER` _into_ the committed
`build/<env>/.env.<env>` file on every run. Consequences: every deploy left uncommitted changes, two
concurrent deploys corrupted each other's values, and a deploy that failed after step 2 left the
file holding a version that was never published.

**Now:** the env file is read and never written. Values are passed to the build and to Trapeze as
environment variables, which is where both already look. `version-code.json` is the only file a
deploy writes, and it is written _after_ the artefact exists, so a failed build no longer consumes a
build number.

## 8. The CLI could not deploy without the app's package.json scripts

`runBuildSteps` was four shell-outs:

```ts
await runCommand(`pnpm run assets:${env}`, root, true);
await runCommand(`pnpm build:${env}`, buildCwd, true);
await runCommand(`pnpm trapeze:${env}`, root, true);
await runCommand(`pnpm exec cap sync ${platform}`, root, true);
```

This required the app to use pnpm, to define scripts under exactly those names, and to have Trapeze
installed. A missing `trapeze:<env>` script was the single most common way a deploy died - halfway
through, after the version bump.

**Now:**

- `pipeline/toolchain.ts` finds executables by walking `node_modules/.bin` upwards from the app, so
  a workspace member and a standalone app both work, and detects the package manager from
  `packageManager` / `devEngines` / lockfile rather than assuming.
- `pipeline/build.ts` resolves the web build in three steps: `build.command` from `project.json`,
  then a `build:<mode>` script if the app has one, then Vite (or `vp`) directly.
- `pipeline/native-config.ts` makes Trapeze **optional**. If it is installed and the flavour has a
  config, Trapeze runs and its YAML stays authoritative. Otherwise the CLI writes the identity and
  version into `build.gradle`, `strings.xml` and `Info.plist` itself, reports which path it took,
  and states what the built-in path cannot do.
- Icon generation is a skip, not a failure, when `@capacitor/assets` or the source artwork is
  missing.

Verified both ways: with Trapeze installed the full pipeline runs
`assets -> build -> trapeze -> cap sync -> 74-file bundle` in 22 s; with the Trapeze config removed
the built-in path switched the app from its staging identity to prod, set `versionCode 77` and
`versionName 20.1.0`, and listed the two files it rewrote.

## 9. Bundling shelled out to a competitor's CLI, then deleted a stray zip

```ts
await runCommand(`npx @capgo/cli bundle zip ${projectConfig.appId} ...`)
const zipFile = findLatestZip(root)   // newest *.zip anywhere in the project root
...
fs.unlinkSync(zipFile.path)
```

A deploy could not run offline, depended on a third-party CLI resolved at deploy time, and then
picked _the newest `.zip` in the project root_ - whatever it was - and deleted it on success.

**Now:** `pipeline/zip.ts` writes the archive itself, named `capucho-bundle-<appId>-<version>.zip`.
The format is dictated by the plugin's Android unzip, and two of its rules fail only on a real
device:

- Entry names must use forward slashes. The unzip rejects any entry containing a backslash outright,
  so a `path.join`-built name produces an archive that installs nowhere.
- `index.html` must be at the archive root, and there must be more than one root entry or the plugin
  descends into the single one as a wrapper.

Both are enforced and tested. Output is byte-reproducible, so an unchanged bundle produces an
identical checksum. Validated against three independent zip implementations - .NET `ZipFile`,
PowerShell `Expand-Archive`, and Python `zipfile.testzip()` for CRCs - plus the real 74-file bundle.

Writing this by hand caught a bug the tests found immediately: `0o100644 << 16` overflows into a
negative int32 and `writeUInt32LE` rejects it.

## 10. The progress display fought itself and lied about the step count

`MultiStepProgress` drove a `cli-progress` MultiBar _and_ an `ora` spinner simultaneously. Both emit
ANSI cursor-movement codes to the same terminal, so they overwrote each other. `totalSteps` was
hard-coded to `9` while steps were skipped conditionally, so `[7/9]` was wrong whenever a flag was
passed, and `fail()` printed the _previous_ step's label as the failure.

**Now:** `Reporter` is told the steps that will actually run, before anything executes, owns a
single spinner, prints plain lines when not attached to a TTY, and attributes a failure to the step
that failed.

## 11. Commands that only pretended to exist

`channel create`, `channel promote` and `deploy rollback` printed "This command is a placeholder"
while appearing in `--help` as working commands. Promotion cannot work from a CLI at all: the
backend re-authenticates it with the user's password (`auth.signInWithPassword`), and a CLI holds an
API key. They are removed rather than left as decoys; promotion stays a dashboard action by design.

`config init` was a second, conflicting init flow that called
`DeployOta.run(['--environment', ...])` - a flag `DeployOta` does not define, so it crashed on use.
Removed; `init` is the one entry point.

`auth whoami` printed organizations and apps read from the local config file, which `auth login`
never wrote, so it always reported "No apps found". It also declared a session valid without
checking. It now asks the server.

## 12. Two 300-line deploy commands that differed in twenty lines

`deploy/ota.ts` and `deploy/native.ts` were near-duplicates, so every fix had to be applied twice -
and was not. The OTA path never sent `version_code`, so the server could not evaluate a bundle's
`min_update_version` gate for it, while the native path did. Both now share `deploy/execute.ts`.

## 13. The app pinned the CLI to a path on one machine

```json
"capucho-cli": "link:../../../../AppData/Local/pnpm/global/5/node_modules/capucho-cli"
```

in `dependencies`, plus a nested `apps/template/pnpm-workspace.yaml` that repeated the same override
and shadowed the real workspace. Nobody else could install this app. Now `workspace:*`.

## 14. Flavours that could not build

- `build/staging/.env.staging` did not exist. Staging is the template's default channel, so every
  staging deploy failed on "Env file for staging not found" - after the version had been bumped.
  Created.
- `build/staging/assets/spalsh.png` - `@capacitor/assets` looks for `splash.png`, so splash
  generation had silently never run. Renamed.
- `build/dev` and `build/prod` have no `assets/` directory, so `pnpm assets:dev` and `assets:prod`
  could only ever fail. The CLI now skips the step and says why.

## 15. Backend

- **Committed credentials** - see the top of this document.
- `crypto: ^1.0.1` in dependencies: an npm placeholder package that shadows Node's built-in
  `crypto`. Removed.
- Unreachable code in `updateService.checkForUpdate`: a `logger.info("No updates available")` and
  `return {}` sat after an unconditional `return`, which is why that log line never appeared.
- `updateRequestSchema` and `uploadRequestSchema` (Joi) are dead: the route uses the looser
  hand-written `validateUpdateParams` instead. The Joi schema also requires `version_build` to be
  valid semver, which the app's `"builtin"` sentinel is not - so wiring it up as-is would break
  every fresh install. Left in place and flagged rather than changed blind.
- `@types/helmet` and `@types/joi` are deprecated stubs; both packages ship their own types.
  Removed.
- `multer@1.x` is end-of-life and `express-rate-limit@6` is two majors behind. Not touched -
  upgrading the upload path deserves its own change with its own testing.

## 16. CI that could not do what it claimed

`apps/template/.github/workflows/android-deploy.yml`:

- Every signing, server-upload and GitHub-release step was gated on
  `steps.env.outputs.deploy_target`. No step had `id: env`. All dead.
- The Supabase insert sent the literal token `VITE_VERSION_CODE` inside a JSON body:
  `\"version_code\": VITE_VERSION_CODE` - invalid JSON.
- It uploaded APKs straight to Supabase Storage with the service key, bypassing `capucho-back`
  entirely: a second, divergent delivery path.
- `pnpm trapeze:${{ inputs.environment }}` with `production` as an allowed input value, while only
  `trapeze:dev|staging|prod` exist.
- It ran `pnpm build` (default env) _after_ `trapeze:<env>`, so the web bundle and the native config
  disagreed.

`ios-deploy.yml` declared an empty `env:` mapping, which GitHub rejects.

**Now:** `deploy-app.yml` contains no build logic. It installs the toolchain and hands the pipeline
to `capucho deploy`, so a CI deploy and a local deploy run the same code. `ci.yml` and
`release-cli.yml` replace the rest. `release-cli.yml` is triggered by a `cli-v*` tag and verifies
the tag matches `packages/cli/package.json`; the old workflow committed and pushed to `main` from
CI, racing developer pushes.

## 17. Smaller things

- `npm version <type> --no-git-tag-version` for version bumps: in a workspace npm resolves the
  nearest `package.json` from the process directory, so running a deploy from the monorepo root
  bumped the root package instead of the app. Replaced with `bumpVersion` in `@capuchoo/core` plus a
  targeted file write that preserves the rest of the file byte-for-byte.
- `exec` with a concatenated shell string: any path containing a space produced the wrong command,
  and output was buffered in memory - a Gradle build exceeds the default 1 MB `maxBuffer` and used
  to fail with a truncated error. Now `spawn` with an argv array, streaming to the log.
- `spawn(..., { shell: true })` with an args array is deprecated in Node 26 (DEP0190) because the
  arguments are concatenated rather than escaped. `.cmd` and `.bat` shims now go through an explicit
  `cmd.exe` invocation with our own quoting.
- `ConfigManager` merged the global and project config into one flat object and read `apiKey` from
  the result, so a committed `project.json` could override the credentials of whoever ran the
  deploy. The two are separate now, and `~/.capucho/config.json` is chmod 600 where the platform
  supports it.
- `auth login` required API keys to start with `cap_` - a server-side format decision the CLI has no
  business enforcing. A rotated prefix would have locked users out.
- `getCurrentVersionCode()` returned `999999` on web, so a browser session claimed to be newer than
  every published release - masking the very bug you would be debugging.
- `deviceId` came from `localStorage`, which is null on a fresh install and is wiped with WebView
  data. It comes from the plugin now, which persists it natively.
- The APK cache filename was prefixed with a hard-coded app name, so two flavours installed side by
  side overwrote each other's download.
- `UpdatePrompt` registered an `App.addListener("backButton")` handler it never removed, and
  `useAppUpdater` did the same for `"resume"`.
- The native update flow had no install step: `handleUpdate` always called `startDownload()`, so a
  downloaded APK dead-ended.
- `ChannelService` called `/api/channel`, which the backend does not implement, and silently
  returned `["development", "staging", "production"]` - hard-coded names that then failed
  server-side validation. `CloudConfigService` cached a `/api/project/config` response nobody read.
  Both deleted.
- Committed build and scratch output: `packages/cli/dist` (54 files), `tsconfig.tsbuildinfo`,
  `tsc_error.txt`, six `type-errors*.txt`, `type-check-output*.txt`, and two empty backend log
  files.
- Five per-package lockfiles, three of them for the same dependency graph.
- The dashboard was still named `capgo-front` and the backend `capgo-selfhosted`, with
  `"author": "Your Name"`.
- The dashboard carried its own `packageManager: pnpm@10.14.0`, contradicting the workspace root.
- `version/bump.ts` shipped 15 lines of the author thinking out loud ("Actually, let's just use
  execSync to call our own CLI or just use the sync logic if we exported it?") and two `@ts-ignore`
  comments that disabled the option validation on its own argument.
- `oclif` bin was `capucho-cli` while every error message told users to run `capucho`. Both names
  now work.
- The `hello` / `hello world` oclif template commands were still shipped.

## Removed features

Two things the old CLI could do that this one cannot. Both are listed here rather than quietly
dropped:

- **`--github-pages` asset publishing.** It mirrored the built `dist` to a branch of a second
  repository via the `gh-pages` package, on the same command that uploaded the artefact - so a
  release had two sources of truth, and the native deploy pushed _web_ assets as a side effect of
  shipping an APK. `ghPagesRepo` is still accepted in `project.json` and ignored, so no existing
  config errors. If you were using it, say so and it comes back as its own command.
- **`channel create` / `channel promote` / `deploy rollback`.** These printed "This command is a
  placeholder" and did nothing. Promotion cannot work from a CLI as the backend stands: it
  re-authenticates with the user's password (`auth.signInWithPassword`), and a CLI holds an API key.
  Rollback is worth building properly - it needs a backend endpoint that activates a previous
  release, which does not exist yet.

## Known-broken, deliberately left alone

- **97 lint warnings** in the imported apps: unused imports, floating promises, `console.log`.
  Visible in `vp lint`, not blocking. Cleaning them is churn without a behaviour change, and doing
  it inside this migration would bury the parts that matter.
- **`multer@1.x` and `express-rate-limit@6`** on the backend. Both need their own change and their
  own testing of the upload path.
- **`typescript` stays on 5.x.** The Vite+ generator suggests 7.x; oclif's typings and `vue-tsc` are
  not validated there yet. Pinned in the catalog with a comment, so it is one deliberate upgrade
  later rather than a surprise.
- **`oclif`'s tsc diagnostics are off in the linter.** Its type checker cannot resolve `.vue` files,
  so enabling them produced ~180 phantom "Cannot find module './Foo.vue'" errors. Each package still
  typechecks with the tool that understands it, in `vp run -r build`.
- **`apps/template`'s cloud app no longer exists.** `capucho channel list` returns "App not found"
  for `cloudAppId 572621ed-...`. Run `capucho init` to relink it. This is why the end-to-end
  verification drove the pipeline directly instead of through `capucho deploy`.
