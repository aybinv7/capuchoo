# CI releases

Git owns source history, tags, release notes and approvals. Capuchoo owns channels, artefacts,
activation and rollback. Neither reaches into the other.

## Credentials

Set these as repository or environment secrets:

- `CAPUCHOO_ENDPOINT` - the backend base URL.
- `CAPUCHOO_API_KEY` - a key scoped to the target application only.

The CLI prefers them over `~/.capuchoo/config.json` whenever both are present, and never writes them
to disk. `capuchoo config list` reports which source was used without printing the key, so its
output is safe to paste into an issue.

## The channel decides the build

A channel is bound to an environment (`dev`, `staging`, `prod`), and that environment selects the
flavour: its env file, its Trapeze config, its icons. So a deploy takes a channel and nothing else:

```sh
capuchoo deploy ota --channel staging --yes
```

There is no `--environment` flag, because there is nothing to get wrong. A channel with no
environment set is rejected, and so is a channel whose environment disagrees with the flavour's
`VITE_APP_ID` - the server enforces the same rule, and finding out client-side saves a 40 MB upload.

## Flavour isolation

A build sees only its flavour file. Every key in `build/<env>/.env.<env>` is passed to the web
build, Trapeze and `cap sync` explicitly, with `VITE_LIVE_RELOAD=false`. When `.env`, `.env.local`,
`.env.<mode>` or `.env.<mode>.local` define a `VITE_*` key the flavour file does not, Vite (and a
`capacitor.config.ts` that loads `.env.local`) would ship this machine's value. A dev or staging
deploy says so and continues; a prod deploy is refused. Set the key in the flavour file, or pass
`--allow-local-env` to accept it. `VITE_LIVE_RELOAD_*` keys are ignored: they only matter while live
reload is on, and a deploy turns it off.

Keys that must never come from anywhere else go in `.capuchoo/project.json`:

```json
{ "requiredEnv": ["VITE_DB_FILENAME", "VITE_API_URL"] }
```

A flavour file that omits one, or leaves it empty, is refused before anything is built.

## Build once, deliver many

A deploy uploads to a release channel (`dev`, `staging`, `prod`). Every other delivery moves a
channel's pointer to an artefact that already exists, so nothing is rebuilt:

```sh
capuchoo channel create prod-acme --client --base prod   # follows prod, takes no uploads
capuchoo release list --channel prod
capuchoo channel point prod-acme --version 2.4.0 --yes
capuchoo channel point prod --version 2.4.0 --native 57 --yes
capuchoo channel point prod --version 2.3.1 --rollback --reason "crash on login" --yes
capuchoo channel pause prod-acme --yes
capuchoo channel resume prod-acme
capuchoo channel history prod-acme
```

A client channel only points at what its base has served. The server decides every move with
`canPoint`; a refusal prints its message and reason code, and under `--json` becomes
`{ "ok": false, "error", "reason", "status" }` on stdout with exit code 1.

## Versions

`package.json` owns the semantic version. `version-code.json` owns the monotonically increasing
native build number per environment.

```sh
capuchoo version sync                              # show what each flavour would build with
capuchoo version bump patch --environment staging  # raise both
```

Neither commits nor tags. A deploy can bump on its own with `-v patch|minor|major`; only a native
deploy consumes a build number, and only after the artefact exists, so a failed build does not burn
one.

The env files are read, never written.

## GitHub Actions

Inside this monorepo, use the `deploy-app` workflow. It installs the toolchain and hands the whole
pipeline to the CLI, so a CI deploy and a local deploy run the same code.

For an application in its own repository, use the composite action:

```yaml
- uses: aybinv7/capuchoo@main # the action lives in packages/cli
  with:
    project-directory: apps/presalio
    channel: staging
    type: ota
    cli-version: 0.16.0 # pin this in production
    release-notes: Presalio v20.0.1
  env:
    CAPUCHOO_ENDPOINT: ${{ secrets.CAPUCHOO_ENDPOINT }}
    CAPUCHOO_API_KEY: ${{ secrets.CAPUCHOO_API_KEY }}
```

The action runs the **published** CLI via `npx`, so consumers do not need this repository's
lockfile, Node version or toolchain. The previous version ran `pnpm install && pnpm build` inside
the action directory on every invocation.

Point production deploys at a protected GitHub environment so they need an approval, and scope its
`CAPUCHOO_API_KEY` to that app.

## GitLab CI

```sh
capuchoo ci init --gitlab --clients acme,globex
```

writes `.gitlab-ci.yml` (`--output` to put it elsewhere, e.g. a monorepo root, then set `APP_DIR`)
from `templates/gitlab-ci.yml`. An existing file is diffed and only replaced after a confirmation or
`--yes`. A release branch publishes to the channel of its environment: the default branch and tags
to `prod`, `$CAPUCHOO_STAGING_BRANCH` (`staging`) to `staging`, `$CAPUCHOO_DEV_BRANCH` (`dev`) to
`dev`.

- `check` - `deploy ota --channel <channel> --dry-run`, the whole pipeline except the upload. It
  also runs on a merge request into a release branch, when `CAPUCHOO_API_KEY` is visible to it.
- `publish:ota` - `deploy ota` on every push, keeping `capuchoo-ota.json` as an artifact. It runs in
  a Node image with no Android SDK.
- `publish:native` - manual. `deploy native --type=release` in a JDK 21 image with the Android SDK
  installed and cached, keeping `capuchoo-native.json`.
- `deliver:<client>` - one manual job per client, on prod only, running
  `capuchoo channel point prod-<client> --version <published version>`, with `--native` when the
  native job ran. Create each channel first with
  `capuchoo channel create prod-<client> --client --base prod`.

Each publish and delivery is a GitLab deployment to an environment named after the channel, so
Operate > Environments lists what every channel received and from which pipeline.

Dependencies are installed with the lockfile's package manager at the version `package.json` pins
(`packageManager`, or `devEngines.packageManager`), and the project's own `capuchoo` runs from
`node_modules/.bin`. Protected variables: `CAPUCHOO_ENDPOINT`, `CAPUCHOO_API_KEY` (masked),
`CAPUCHOO_SIGNING_KEY` (masked), and for native builds `ANDROID_KEYSTORE_BASE64` (a masked File
variable holding the base64 keystore) with `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and
`ANDROID_KEY_PASSWORD`. Protect the three release branches, or their pipelines will not see them.

## Native builds

`deploy native` refuses to publish an unsigned release APK - Android will not install one. Provide
signing material through the environment:

- `CAPUCHOO_KEYSTORE_FILE` (relative to `android/`)
- `CAPUCHOO_KEYSTORE_PASSWORD`
- `CAPUCHOO_KEY_ALIAS`
- `CAPUCHOO_KEY_PASSWORD`

`android/app/build.gradle` attaches its release `signingConfig` only when `CAPUCHOO_KEYSTORE_FILE`
is set, so a developer can still build an unsigned APK locally to inspect it.

Incomplete release signing is a hard error for `--type release` and for every prod or client
channel: a debug-signed APK cannot upgrade a release install. Without `--type`, a dev or staging
channel falls back to debug with a warning. `--type debug` is refused on prod and client channels,
and `--allow-unsigned` publishes to dev channels only.

After the build the CLI reads the APK signing certificate (`apksigner verify --print-certs`, then
`keytool -printcert -jarfile`), sends it as `signing_cert_sha256`, and refuses to upload when it
differs from the previous native release of the same flavour. `--allow-cert-change` overrides that,
for a deliberate re-key where every device is reinstalled.

iOS is not driven by the CLI yet: archive through Xcode and register the build in the dashboard.

## Release signing

Every OTA bundle and APK can carry an ECDSA P-256 signature the server and the updater verify.

```sh
capuchoo keys init   # writes .capuchoo/signing-key.pem (owner-only, git-ignored), uploads the public key
capuchoo keys show   # fingerprint, and whether each flavour bakes the public key
```

`keys init` offers to add the key path to `.gitignore` (with a diff) before writing anything, and
prints the `VITE_UPDATE_PUBLIC_KEY=...` line to add to each flavour file. It reuses an existing key;
`--force` rotates it, which makes installed builds reject everything the new key signs.

In CI, set `CAPUCHOO_SIGNING_KEY` to the base64 PKCS#8 body of that file (masked, protected). A
deploy signs the artefact's SHA-256 and sends `signature`. It refuses before building when the app
requires signatures and no key is available, when the key is not the one the server holds, or when
the flavour's `VITE_UPDATE_PUBLIC_KEY` belongs to another key.

## Machine-readable output

`--json` puts a single result document on stdout and every human-facing line on stderr:

```sh
capuchoo deploy ota --channel staging --yes --json > result.json
```

```json
{
  "ok": true,
  "version": "19.0.1",
  "versionCode": 11,
  "channel": "staging",
  "environment": "staging",
  "uploaded": true,
  "artifact": { "bytes": 3601005, "files": 74 },
  "nativeConfig": "trapeze",
  "skipped": [],
  "warnings": []
}
```

`--dry-run` runs everything except the upload, which makes it a real pre-merge check.

On failure the document is `{ "ok": false, "error": "..." }`, and the process exits non-zero. Full
command output is appended to `capuchoo-deploy.log` in the app directory.

## Publishing the CLI

Tag `cli-v<version>` matching `packages/cli/package.json`. `release-cli.yml` verifies they agree,
builds, tests and publishes to npm with provenance.

Nothing writes back to the repository. The earlier workflow committed a regenerated README and
pushed to `main` from CI, which raced developer pushes.

## Removed: GitHub Pages asset publishing

`--github-pages` and its `gh-pages` dependency are gone. It mirrored the built `dist` to a branch of
a second repository, which duplicated what the artefact upload already does and gave a release two
sources of truth.

`ghPagesRepo` is still accepted in `.capuchoo/project.json` and ignored, so an existing config does
not error. If you were relying on this, say so - it should come back as a deliberate publish step
rather than a flag buried inside deploy.
