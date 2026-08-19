# CI releases

Capucho is the delivery layer for Capacitor applications. GitHub owns source history, tags, release notes, approvals, and build artifacts. Capucho owns channels, OTA/native uploads, activation, and rollback.

## CI credentials

Set these repository or environment secrets in the CI system:

- `CAPUCHO_ENDPOINT` — the Capucho backend base URL.
- `CAPUCHO_API_KEY` — an API key with access only to the target application.

The CLI uses these variables when present. They override the developer-local `~/.capucho/config.json` and are never written to disk.

## Version source of truth

`package.json` owns the semantic version. `version-code.json` owns the monotonically increasing native code for each environment. The command below updates the selected environment’s `.env` file and native version code after changing the package version:

```sh
capucho-cli version bump patch --environment staging
```

Use a GitHub release tag such as `presalio-v20.0.1` for a monorepo application. Create the tag only after the changed version files are committed.

## GitHub Actions

The repository consuming Capucho should pin this action to a released Capucho CLI tag:

```yaml
- uses: aybinv7/capucho-cli@v0.1.2
  with:
    project-directory: apps/presalio
    channel: staging
    type: ota
    release-notes: Presalio v20.0.1
  env:
    CAPUCHO_ENDPOINT: ${{ secrets.CAPUCHO_ENDPOINT }}
    CAPUCHO_API_KEY: ${{ secrets.CAPUCHO_API_KEY }}
```

The calling workflow should create the Git tag and GitHub Release, then invoke the action from that exact commit. Production deployments should use a protected GitHub environment for approval and scoped secrets.

## Asset publishing

GitHub Pages publishing is disabled by default. Enable it only with `--github-pages` and a deliberate `ghPagesRepo` value in `.capucho/project.json`. Capucho never falls back to another project’s repository.

## Ecosystem boundaries

- `capucho-cli` builds and uploads releases.
- `capucho-back` stores applications, channels, update metadata, and uploaded artifacts.
- `capucho-app` is the dashboard for organizations, applications, channels, and release visibility.
- `capucho-apps-manager` is a device-side Capacitor plugin for installed-app information; it is not part of the deployment control plane.
