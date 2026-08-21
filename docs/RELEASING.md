# Releasing

Four packages publish to npm. The apps and the backend do not - they are `private: true`, and
`pnpm publish -r` skips them.

| Package                  | What it is                                        |
| ------------------------ | ------------------------------------------------- |
| `@capuchoo/core`         | The shared contract. Dependency-free.             |
| `@capuchoo/updater`      | App-side runtime.                                 |
| `@capuchoo/cli`          | The deploy pipeline.                              |
| `@capuchoo/apps-manager` | Capacitor plugin: lists apps installed on device. |

## How a release happens

1. Bump the version in the package's `package.json`. That file is the source of truth for what gets
   released.
2. Run the **release** workflow (Actions > release > Run workflow). Leave `dry-run` checked the
   first time and read the log.
3. Run it again with `dry-run` unchecked.

`npm publish` refuses a version that already exists, so a run only ships the packages you actually
bumped and re-running is safe. Nothing writes back to the repository, so no bot commit races a
developer push.

This replaced `release-cli.yml`, which handled only the CLI and was triggered by a `cli-v*` tag. Two
release paths over one workspace is how they drift - the same lesson as the two parallel
app-management APIs in [BACKEND-AUDIT.md](./BACKEND-AUDIT.md).

## Trusted publishing, and why the first release is manual

CI authenticates by **trusted publishing**: the workflow exchanges a short-lived GitHub OIDC token
for a publish credential scoped to this repository and this workflow file. There is no `NPM_TOKEN`
anywhere - nothing to leak, nothing to rotate, and it satisfies the account's 2FA requirement, which
a CI job cannot do interactively.

The catch: a trusted publisher is configured **per package** in that package's settings on
npmjs.com, which requires the package to exist. So version one of each package is published by hand,
once:

```sh
# from the workspace root, after `npm login` (run that from outside this
# directory - see the devEngines note below)
pnpm publish -r --access public --otp=<code-from-your-authenticator>
```

Then, for each of the four packages on npmjs.com: **Settings > Trusted publisher**, GitHub Actions,
repository `aybinv7/capucho`, workflow `release.yml`. After that every release runs from CI and the
manual path is never needed again.

## Two traps worth knowing

**npm will not run inside this workspace.** The root `package.json` declares
`devEngines.packageManager: pnpm`, so any `npm` command below it fails with `EBADDEVENGINES` -
including `npm login` and `npm publish`. Run `npm login` from your home directory, and note that the
workflow publishes from `$RUNNER_TEMP` for exactly this reason.

**npm cannot resolve `catalog:` or `workspace:*`.** pnpm rewrites both into concrete ranges in the
published manifest, which is why the workflow packs with pnpm and publishes the resulting tarball
with npm rather than using either tool for both halves.

## What the workflow checks first

`vp check`, `vp run -r build`, `vp run -r test` all run before the publish step. npm has no useful
undo - unpublishing is restricted to 72 hours and forbidden once anything depends on the version -
so a broken package is worse than a late one.

## Things pnpm handles that npm cannot

The manifests use `catalog:` for shared dependency versions and `workspace:*` between packages. npm
understands neither. pnpm rewrites both into concrete ranges in the **published** manifest while
leaving the repository unchanged:

```
"@capacitor/core": "catalog:"    ->  "^8.0.0"
"@capuchoo/core": "workspace:*"   ->  "0.1.0"
```

Verify before a release with `pnpm pack` in the package directory, then read the `package.json`
inside the tarball. `files` is set on every package, so a tarball should contain `dist` and little
else.

## Consuming from a sibling project

Applications like Lowmaro should depend on the published versions:

```json
{
  "dependencies": {
    "@capuchoo/core": "^0.1.0",
    "@capuchoo/updater": "^0.1.0"
  },
  "devDependencies": {
    "@capuchoo/cli": "^0.2.0"
  }
}
```

A `link:` to `../capucho/capucho/packages/*` works only on the machine where both trees exist: a
fresh clone cannot install, so CI cannot build, and nothing pins a version - a breaking change lands
silently on the next build. Link only while developing both trees at once, with `pnpm link --global`
or an override you do not commit.

## Versions are pre-1.0

`@capuchoo/core` and `@capuchoo/updater` are `0.1.x`: the surface may change between minor versions.
They are published because the CLI and the apps need them, not as general-purpose libraries.
