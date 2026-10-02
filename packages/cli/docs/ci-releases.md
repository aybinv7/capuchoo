# CI releases

Git owns source history, tags, release notes and approvals. Capuchoo owns channels, artefacts,
activation and rollback. Neither reaches into the other.

## Credentials

Set these as CI/CD variables or secrets:

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

Neither commits nor tags. A deploy takes its version from `-v`:

- `patch`, `minor`, `major` - bump `package.json` and publish that.
- `1.2.0` or `v1.2.0` - publish exactly that, e.g. a git tag's version.
- `auto` - on dev and staging, a prerelease of the next patch numbered after the highest one the
  server holds: `0.1.10` publishes `0.1.11-dev.1`, then `0.1.11-dev.2`. It sorts above what devices
  run and below the `0.1.11` a prod release will take, and needs no commit, so every CI push gets a
  fresh version. On prod it publishes `package.json` as-is, because a prod version is a decision.

Bundle versions are unique per app across every flavour. A deploy whose version the server already
holds is refused before anything is built; a dry run says so and continues.

Only a native deploy consumes a build number, and only after the artefact exists, so a failed build
does not burn one. The number is the next one in `version-code.json`, or the one after the highest
the server holds for that flavour when that is higher, so a CI clone whose file never received the
last bump cannot collide.

The env files are read, never written.

## GitHub Actions

```sh
capuchoo ci init --github --clients acme,globex
```

writes `.github/workflows/capuchoo.yml` at the root of the git repository that holds the current
directory. `@capuchoo/core` renders it, so it is the same file, byte for byte, as the one the
dashboard's setup pull request adds. An existing file is diffed and only replaced after a
confirmation or `--yes`. Regenerate it rather than editing it: the dashboard reads the job graph
from it.

| Flag               | Default                                                    |
| ------------------ | ---------------------------------------------------------- |
| `--app-dir`        | the path from the repository root to the current directory |
| `--default-branch` | the branch `origin/HEAD` points at, else `main`            |
| `--dev-branch`     | `dev`                                                      |
| `--staging-branch` | `staging`                                                  |
| `--clients`        | none; each client becomes a `client` choice for `deliver`  |
| `--output`         | `.github/workflows/capuchoo.yml` at the repository root    |

GitHub only runs workflows from `.github/workflows` at the repository root, and the dashboard reads
`capuchoo.yml` there unless the app's workflow path is changed; `ci init` warns when `--output` puts
the file anywhere else. A value that would be unsafe in the YAML - a branch name with a quote, an
`--app-dir` containing `..`, one branch used for two channels - is refused and nothing is written.

| Event                              | Channel                                | Version                            |
| ---------------------------------- | -------------------------------------- | ---------------------------------- |
| push to `dev`                      | `dev`                                  | `-v auto`                          |
| push to `staging`                  | `staging`                              | `-v auto`                          |
| tag `v1.2.0`                       | `prod`                                 | `1.2.0`                            |
| push to the default branch         | rehearsal against `prod`               | -                                  |
| pull request into a release branch | rehearsal against the target's channel | -                                  |
| Run workflow                       | the `channel` input, else as above     | the `version` input, else as above |

Jobs:

- `plan` - resolves the action, channel, version and client from the event and the inputs, and stops
  the run on an unknown action, a malformed channel or version, `prod` at `-v auto`, or a `deliver`
  without an exact version and one of the generated clients.
- `check` - `deploy ota --dry-run`, the whole pipeline except the upload. Pull requests from forks
  skip it, because they cannot read the secrets.
- `publish-ota` - `deploy ota`, keeping `capuchoo-ota.json` and `capuchoo-deploy.log` as an
  artifact.
- `publish-native` - only when a run asks for `native`. JDK 21 and the Android SDK, then
  `deploy native --type=<build_type>`. `release`, the default, restores the keystore from the
  secrets and fails without it; `debug` skips it.
- `deliver` - only when generated with `--clients`. Runs
  `capuchoo channel point prod-<client> --version <version>` with the CLI version the file pins.
  Nothing is built.

"Run workflow" takes `action` (`ota`, `native`, `check`, `deliver`), `channel`, `version`, `client`,
`notes` and `build_type`. A native APK is built only when a run asks for one, so a web-only change
never waits for Gradle.

Each publish job runs in a GitHub environment named after its channel (`dev`, `staging`, `prod`),
and `deliver` in `prod-<client>`. To require an approval, add required reviewers to `prod` and to
every `prod-<client>` under Settings > Environments. Environment secrets work as well, for example
an API key used only by `prod`. Runs for the same channel queue instead of overlapping.

| Name                        | Kind     | Needed for                                                  |
| --------------------------- | -------- | ----------------------------------------------------------- |
| `CAPUCHOO_ENDPOINT`         | variable | every job: the backend base URL                             |
| `CAPUCHOO_API_KEY`          | secret   | every job: an API key scoped to this app                    |
| `CAPUCHOO_SIGNING_KEY`      | secret   | optional: base64 PKCS#8 body of `.capuchoo/signing-key.pem` |
| `ANDROID_KEYSTORE_BASE64`   | secret   | native release builds: the release keystore, base64         |
| `ANDROID_KEYSTORE_PASSWORD` | secret   | native release builds                                       |
| `ANDROID_KEY_ALIAS`         | secret   | native release builds                                       |
| `ANDROID_KEY_PASSWORD`      | secret   | native release builds                                       |

The keystore is written to `android/release.keystore` and removed when the job ends. Its values are
appended to `android/local.properties` as `RELEASE_STORE_FILE`, `RELEASE_STORE_PASSWORD`,
`RELEASE_KEY_ALIAS` and `RELEASE_KEY_PASSWORD`, and exported as `CAPUCHOO_KEYSTORE_*`.

Dependencies are installed with the lockfile's package manager at the version `package.json` pins,
and `capuchoo` runs from the project's `node_modules/.bin`, so the app needs `@capuchoo/cli` as a
dev dependency.

### From the dashboard

App settings > CI connects an app to a repository through the instance's GitHub App. From there the
dashboard:

- opens a pull request that adds the same workflow, with the options `ci init --github` takes;
- sets the secrets and the `CAPUCHOO_ENDPOINT` variable. Secrets are encrypted in the browser with
  the repository's public key, so the keystore and its passwords never reach Capuchoo;
- starts runs with the "Run workflow" inputs above, and shows each run as soon as it starts.

Runs started any other way arrive through webhooks. A deploy inside a run sends the run id, attempt
and job (`GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`, `GITHUB_JOB`) with its build, so its steps appear
under that job. [CI providers](../../../docs/CI-PROVIDERS.md) describes the integration.

### One step in an existing workflow

Inside this monorepo, the `deploy-app` workflow does this. For an application in its own repository
that already has a workflow, the composite action runs a single deploy:

```yaml
- uses: aybinv7/capuchoo@main # the action lives in packages/cli
  with:
    project-directory: apps/presalio
    channel: staging
    type: ota
    cli-version: 0.16.0 # pin this in production
    release-notes: Presalio v20.0.1
  env:
    CAPUCHOO_ENDPOINT: ${{ vars.CAPUCHOO_ENDPOINT }}
    CAPUCHOO_API_KEY: ${{ secrets.CAPUCHOO_API_KEY }}
```

The action runs the published CLI through `npx`, so it needs neither this repository's lockfile nor
its toolchain.

## GitLab CI

```sh
capuchoo ci init --gitlab --clients acme,globex
```

writes `.gitlab-ci.yml` (`--output` to put it elsewhere, e.g. a monorepo root, then set `APP_DIR`)
from `templates/gitlab-ci.yml`. `--dev-branch` and `--staging-branch` name the release branches
(`dev` and `staging` by default). An existing file is diffed and only replaced after a confirmation
or `--yes`.

| Ref                                    | Channel                  | Version                        |
| -------------------------------------- | ------------------------ | ------------------------------ |
| `$CAPUCHOO_DEV_BRANCH` (`dev`)         | `dev`                    | `-v auto`, e.g. `0.1.11-dev.4` |
| `$CAPUCHOO_STAGING_BRANCH` (`staging`) | `staging`                | `-v auto`                      |
| a tag `v1.2.0`                         | `prod`                   | `1.2.0`                        |
| the default branch                     | rehearsal against `prod` | -                              |

- `check` - `deploy ota --dry-run`, the whole pipeline except the upload. It also runs on the
  default branch and on a merge request into a release branch, when `CAPUCHOO_API_KEY` is visible to
  it.
- `publish:ota` - `deploy ota` on a push to dev or staging and on a tag, keeping `capuchoo-ota.json`
  as an artifact. It runs in a Node image with no Android SDK.
- `publish:native` - manual. `deploy native --type=release` in a JDK 21 image with the Android SDK
  installed and cached, keeping `capuchoo-native.json`.
- `deliver:<client>` - one manual job per client, on tags only, running
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

### API-started pipelines

A pipeline created through the GitLab API (`$CI_PIPELINE_SOURCE == "api"`) with `CAPUCHOO_ACTION`
set runs what its variables ask for instead of what its ref implies. This is how the dashboard
starts a GitLab run, once App settings > CI holds a project access token; the variables it passes
come from `GITLAB_PIPELINE_VARIABLES` in `@capuchoo/core`.

| Variable              | Meaning                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `CAPUCHOO_ACTION`     | `ota`, `native`, `check` or `deliver`                                                       |
| `CAPUCHOO_CHANNEL`    | the channel; empty takes it from the ref as a push would, with the default branch as `prod` |
| `CAPUCHOO_VERSION`    | `auto` or `x.y.z`; empty takes the tag, else `auto`                                         |
| `CAPUCHOO_CLIENT`     | `deliver` only: one of the clients generated with `--clients`                               |
| `CAPUCHOO_NOTES`      | release notes; empty uses the tag or short commit SHA and the commit title                  |
| `CAPUCHOO_BUILD_TYPE` | `native` only: `release`, the default, which needs the keystore variables, or `debug`       |

- `ota` - `check`, then `publish:ota`, with no manual step. On a tag, the manual `deliver:<client>`
  jobs follow, as they do after a tag push.
- `native` - `check`, then `publish:native`, started automatically.
- `check` - `check` only.
- `deliver` - only `deliver:api`, which points `prod-$CAPUCHOO_CLIENT` at `$CAPUCHOO_VERSION`.
  Nothing is built. It uses the same `prod-<client>` environment and resource group as
  `deliver:<client>`, so a protected environment's approval rules apply to both.

A `CAPUCHOO_CHANNEL` passed with the pipeline wins over the ref's channel, because pipeline
variables take precedence over `rules:variables`. Before anything is installed, the pipeline refuses
an unknown action, a ref with no channel, a malformed channel or version, and `prod` at `auto` for
`ota` and `native`. `deliver:api` refuses a client the file was not generated for, and an empty or
`auto` version.

A pipeline started through the API without `CAPUCHOO_ACTION` behaves like a push to its ref.
Protected variables reach only protected refs, so start API pipelines on the release branches or on
tags, or the jobs will not see `CAPUCHOO_API_KEY`.

## Native Android apps

A Kotlin, Java or Kotlin Multiplatform app with no Capacitor is a `runtime: "android"` project.
`capuchoo init` in its Gradle root detects the module that applies the Android application plugin,
registers the `applicationId` each environment flavour installs under, and prints the Gradle and
`Capuchoo.init` lines for [Capuchoo for Android](../../android/README.md), filled with this server's
endpoint and release key.

```sh
capuchoo deploy native --channel staging            # assembles the staging variant
capuchoo deploy native --channel dev -v auto        # 1.3.1-dev.4, build above the server's
capuchoo deploy native --channel prod --apk app-prod-release.apk
```

Every version is read back from the built APK's manifest. With `-v`, the deploy passes it as
`-Pcapuchoo.versionName` and `-Pcapuchoo.versionCode`; a build file that does not read them is
caught, and the two `defaultConfig` lines that fix it are printed. There is no OTA path: Kotlin and
Java cannot be replaced over the air.

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
