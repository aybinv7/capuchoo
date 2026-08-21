# Capuchooo CLI

Builds and publishes releases. Release operations: [docs/ci-releases.md](docs/ci-releases.md).

## The rule this package exists to keep

The CLI owns the deploy pipeline. It must work in an application it has never seen, whatever that
application's scripts are named and whatever it has installed.

Concretely: never shell out to a `package.json` script as the primary path, never assume a package
manager, and treat every external tool as optional. `pipeline/toolchain.ts` resolves executables
from `node_modules/.bin` upwards; `pipeline/build.ts` and `pipeline/native-config.ts` each have a
fallback chain and report which branch they took. A missing tool is a skip or a substitution with an
explanation - never a deploy that stops halfway.

## Structure

- `commands/` - oclif command classes only. **Every file here becomes a command**, so shared code
  goes elsewhere; `deploy/execute.ts` holds the implementation both deploy commands share.
- `pipeline/` - the deploy steps. Pure where possible, so they are testable without a device or a
  server.
- `services/cloud.ts` - the only place that talks to the API.
- `utils/` - exec, http, config, reporter.

Built with `tsc`, not `vp pack`: oclif discovers commands by walking `dist/commands`, one module per
command, and a bundler collapses them.

## Invariants worth not breaking

- **Validate before mutating.** The old pipeline bumped the version first and found a missing env
  file second, leaving the repo on a version that was never published. Cheap checks go before
  anything that writes or uploads.
- **Never write to an env file.** Build values are passed as environment. `version-code.json` is the
  only tracked file a deploy touches, written after the artefact exists.
- **The OTA archive format is not ours to choose.** Forward-slash entry names (the Android unzip
  rejects a backslash outright) and `index.html` at the root. `pipeline/zip.test.ts` pins both.
- **Never publish an unsigned release APK.** Gradle produces one happily when the project has no
  `signingConfig`, and Android will not install it.
- **stdout is for `--json` only.** Everything human goes to stderr, so the output stays parseable.
