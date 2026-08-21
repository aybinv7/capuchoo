@capuchoo/cli
=============

Capucho CLI bundles and uploads your application to the cloud. It packages builds as native
artifacts or ZIP files, then publishes them using user-defined parameters such as channels and
custom release options. Built for simple, repeatable deployments, it integrates cleanly into local
workflows and CI pipelines to ship updates quickly and reliably.

For team release operations, version ownership, GitHub Actions integration, and ecosystem
boundaries, see [CI releases](docs/ci-releases.md).

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/%40capuchoo%2Fcli.svg)](https://npmjs.org/package/@capuchoo/cli)
[![Downloads/week](https://img.shields.io/npm/dw/%40capuchoo%2Fcli.svg)](https://npmjs.org/package/@capuchoo/cli)

<!-- toc -->

- [Usage](#usage)
- [Commands](#commands)

<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g @capuchoo/cli
$ capucho COMMAND
running command...
$ capucho (--version)
@capuchoo/cli/0.2.0 win32-x64 node-v26.4.0
$ capucho --help [COMMAND]
USAGE
  $ capucho COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`capucho auth login`](#capucho-auth-login)
- [`capucho auth logout`](#capucho-auth-logout)
- [`capucho auth whoami`](#capucho-auth-whoami)
- [`capucho channel list`](#capucho-channel-list)
- [`capucho config list`](#capucho-config-list)
- [`capucho config set KEY VALUE`](#capucho-config-set-key-value)
- [`capucho deploy native`](#capucho-deploy-native)
- [`capucho deploy ota`](#capucho-deploy-ota)
- [`capucho help [COMMAND]`](#capucho-help-command)
- [`capucho init`](#capucho-init)
- [`capucho version bump TYPE`](#capucho-version-bump-type)
- [`capucho version sync`](#capucho-version-sync)

## `capucho auth login`

Store an API key for the Capucho backend

```
USAGE
  $ capucho auth login [-k <value>] [-e <value>]

FLAGS
  -e, --endpoint=<value>  Backend base URL
  -k, --api-key=<value>   API key from Settings > API Keys in the dashboard

DESCRIPTION
  Store an API key for the Capucho backend

EXAMPLES
  $ capucho auth login

  $ capucho auth login --endpoint https://capucho.internal --api-key cap_...
```

_See code:
[src/commands/auth/login.ts](https://github.com/aybinv7/capucho/blob/v0.2.0/src/commands/auth/login.ts)_

## `capucho auth logout`

Remove the stored API key

```
USAGE
  $ capucho auth logout

DESCRIPTION
  Remove the stored API key
```

_See code:
[src/commands/auth/logout.ts](https://github.com/aybinv7/capucho/blob/v0.2.0/src/commands/auth/logout.ts)_

## `capucho auth whoami`

Show the signed-in account, and the organizations and apps it can reach

```
USAGE
  $ capucho auth whoami [--json]

FLAGS
  --json  Machine-readable output

DESCRIPTION
  Show the signed-in account, and the organizations and apps it can reach
```

_See code:
[src/commands/auth/whoami.ts](https://github.com/aybinv7/capucho/blob/v0.2.0/src/commands/auth/whoami.ts)_

## `capucho channel list`

List this app's channels and what they serve

```
USAGE
  $ capucho channel list [--json]

FLAGS
  --json  Machine-readable output

DESCRIPTION
  List this app's channels and what they serve
```

_See code:
[src/commands/channel/list.ts](https://github.com/aybinv7/capucho/blob/v0.2.0/src/commands/channel/list.ts)_

## `capucho config list`

Show the resolved configuration, and which build tools were found

```
USAGE
  $ capucho config list [--json]

FLAGS
  --json  Machine-readable output

DESCRIPTION
  Show the resolved configuration, and which build tools were found
```

_See code:
[src/commands/config/list.ts](https://github.com/aybinv7/capucho/blob/v0.2.0/src/commands/config/list.ts)_

## `capucho config set KEY VALUE`

Set a user preference in ~/.capucho/config.json

```
USAGE
  $ capucho config set KEY VALUE

ARGUMENTS
  KEY    (endpoint|defaultChannel) Preference to set
  VALUE  New value

DESCRIPTION
  Set a user preference in ~/.capucho/config.json

EXAMPLES
  $ capucho config set endpoint https://capucho.internal

  $ capucho config set defaultChannel staging
```

_See code:
[src/commands/config/set.ts](https://github.com/aybinv7/capucho/blob/v0.2.0/src/commands/config/set.ts)_

## `capucho deploy native`

Build and publish a native binary (APK). Users install it through the OS.

```
USAGE
  $ capucho deploy native [-c <value>] [-n <value>] [-v major|minor|patch] [-a] [-r] [--skip-assets] [--skip-build]
    [--dry-run] [--json] [--verbose] [-y] [-p android|ios] [-t debug|release] [--allow-unsigned]

FLAGS
  -a, --[no-]active        Serve this release immediately
  -c, --channel=<value>    Channel to publish to. Its environment selects the flavour.
  -n, --note=<value>       Release notes shown to users
  -p, --platform=<option>  [default: android] Target platform
                           <options: android|ios>
  -r, --[no-]required      Users cannot postpone this release
  -t, --type=<option>      [default: release] Gradle variant to assemble
                           <options: debug|release>
  -v, --version=<option>   Bump the app version before publishing
                           <options: major|minor|patch>
  -y, --yes                Accept every prompt - required in CI
      --allow-unsigned     Publish a release build with no signature. Android will refuse to install it.
      --dry-run            Build and package, but upload nothing
      --json               Emit a machine-readable result on stdout
      --skip-assets        Do not regenerate launcher icons
      --skip-build         Publish the existing build output as-is
      --verbose            Stream build output to the terminal

DESCRIPTION
  Build and publish a native binary (APK). Users install it through the OS.

EXAMPLES
  $ capucho deploy native --channel staging

  $ capucho deploy native -c production -v minor --type release

  $ capucho deploy native -c staging --type debug -y
```

_See code:
[src/commands/deploy/native.ts](https://github.com/aybinv7/capucho/blob/v0.2.0/src/commands/deploy/native.ts)_

## `capucho deploy ota`

Publish a web bundle over the air. Does not change the installed binary.

```
USAGE
  $ capucho deploy ota [-c <value>] [-n <value>] [-v major|minor|patch] [-a] [-r] [--skip-assets] [--skip-build]
    [--dry-run] [--json] [--verbose] [-y]

FLAGS
  -a, --[no-]active       Serve this release immediately
  -c, --channel=<value>   Channel to publish to. Its environment selects the flavour.
  -n, --note=<value>      Release notes shown to users
  -r, --[no-]required     Users cannot postpone this release
  -v, --version=<option>  Bump the app version before publishing
                          <options: major|minor|patch>
  -y, --yes               Accept every prompt - required in CI
      --dry-run           Build and package, but upload nothing
      --json              Emit a machine-readable result on stdout
      --skip-assets       Do not regenerate launcher icons
      --skip-build        Publish the existing build output as-is
      --verbose           Stream build output to the terminal

DESCRIPTION
  Publish a web bundle over the air. Does not change the installed binary.

EXAMPLES
  $ capucho deploy ota --channel staging

  $ capucho deploy ota -c production -v patch -n 'Fixes the invoice total'

  $ capucho deploy ota -c staging --dry-run
```

_See code:
[src/commands/deploy/ota.ts](https://github.com/aybinv7/capucho/blob/v0.2.0/src/commands/deploy/ota.ts)_

## `capucho help [COMMAND]`

Display help for capucho.

```
USAGE
  $ capucho help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for capucho.
```

_See code:
[@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/6.2.58/src/commands/help.ts)_

## `capucho init`

Link this directory to a Capucho app and write .capucho/project.json

```
USAGE
  $ capucho init [-l] [-f]

FLAGS
  -f, --force  Overwrite an existing project.json
  -l, --link   Link an existing app instead of creating one

DESCRIPTION
  Link this directory to a Capucho app and write .capucho/project.json

EXAMPLES
  $ capucho init

  $ capucho init --link
```

_See code:
[src/commands/init.ts](https://github.com/aybinv7/capucho/blob/v0.2.0/src/commands/init.ts)_

## `capucho version bump TYPE`

Raise the app's semantic version, and optionally an environment's build number

```
USAGE
  $ capucho version bump TYPE [-e dev|staging|prod]

ARGUMENTS
  TYPE  (major|minor|patch) Which part of the version to raise

FLAGS
  -e, --environment=<option>  Also increment this environment's native build number
                              <options: dev|staging|prod>

DESCRIPTION
  Raise the app's semantic version, and optionally an environment's build number

EXAMPLES
  $ capucho version bump patch

  $ capucho version bump minor --environment staging
```

_See code:
[src/commands/version/bump.ts](https://github.com/aybinv7/capucho/blob/v0.2.0/src/commands/version/bump.ts)_

## `capucho version sync`

Show, or advance, the version and build number used for each flavour

```
USAGE
  $ capucho version sync [-b] [-e dev|staging|prod] [--json]

FLAGS
  -b, --bump                  Increment the build number for the selected environments
  -e, --environment=<option>  Limit to one environment
                              <options: dev|staging|prod>
      --json                  Machine-readable output

DESCRIPTION
  Show, or advance, the version and build number used for each flavour

EXAMPLES
  $ capucho version sync

  $ capucho version sync --bump --environment staging
```

_See code:
[src/commands/version/sync.ts](https://github.com/aybinv7/capucho/blob/v0.2.0/src/commands/version/sync.ts)_
<!-- commandsstop -->
