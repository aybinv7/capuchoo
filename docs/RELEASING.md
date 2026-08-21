# Releasing

Four packages publish to npm. The apps and the backend do not - they are `private: true`, and
`pnpm publish -r` skips them.

| Package                | What it is                                        |
| ---------------------- | ------------------------------------------------- |
| `@capucho/core`        | The shared contract. Dependency-free.             |
| `@capucho/updater`     | App-side runtime.                                 |
| `capucho-cli`          | The deploy pipeline.                              |
| `capucho-apps-manager` | Capacitor plugin: lists apps installed on device. |

## How a release happens

1. Bump the version in the package's `package.json`. That file is the source of truth for what gets
   released.
2. Run the **release** workflow (Actions > release > Run workflow). Leave `dry-run` checked the
   first time and read the log.
3. Run it again with `dry-run` unchecked.

`pnpm publish -r` is idempotent: it skips any package whose version already exists on the registry.
Running the workflow twice publishes nothing the second time, and a release that only bumped one
package touches only that package. Nothing writes back to the repository, so no bot commit races a
developer push.

This replaced `release-cli.yml`, which handled only the CLI and was triggered by a `cli-v*` tag. Two
release paths over one workspace is how they drift - the same lesson as the two parallel
app-management APIs in [BACKEND-AUDIT.md](./BACKEND-AUDIT.md).

## Prerequisites, once

- **The `capucho` npm organisation.** `@capucho/*` is a scoped name and the scope has to be owned
  before anything can be published under it. Free for public packages.
- **An `NPM_TOKEN` repository secret.** Use an automation or granular token: those bypass 2FA, which
  an interactive login cannot do from CI. Never a personal login token pasted into a terminal.

Provenance is a workflow input, defaulting off, because npm requires a public source repository to
attest a build. Turn it on when this repository goes public.

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
"@capucho/core": "workspace:*"   ->  "0.1.0"
```

Verify before a release with `pnpm pack` in the package directory, then read the `package.json`
inside the tarball. `files` is set on every package, so a tarball should contain `dist` and little
else.

## Consuming from a sibling project

Applications like Lowmaro should depend on the published versions:

```json
{
  "dependencies": {
    "@capucho/core": "^0.1.0",
    "@capucho/updater": "^0.1.0"
  },
  "devDependencies": {
    "capucho-cli": "^0.2.0"
  }
}
```

A `link:` to `../capucho/capucho/packages/*` works only on the machine where both trees exist: a
fresh clone cannot install, so CI cannot build, and nothing pins a version - a breaking change lands
silently on the next build. Link only while developing both trees at once, with `pnpm link --global`
or an override you do not commit.

## Versions are pre-1.0

`@capucho/core` and `@capucho/updater` are `0.1.x`: the surface may change between minor versions.
They are published because the CLI and the apps need them, not as general-purpose libraries.
