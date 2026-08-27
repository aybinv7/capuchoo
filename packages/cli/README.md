@capuchoo/cli
=============

Capuchoo CLI bundles and uploads your application to the cloud. It packages builds as native
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
$ capuchoo COMMAND
running command...
$ capuchoo (--version)
@capuchoo/cli/0.9.1 win32-x64 node-v24.20.0
$ capuchoo --help [COMMAND]
USAGE
  $ capuchoo COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`capuchoo app delete [APPID]`](#capuchoo-app-delete-appid)
- [`capuchoo app grant EMAIL ROLE`](#capuchoo-app-grant-email-role)
- [`capuchoo app identifiers [ACTION] [BUNDLEID]`](#capuchoo-app-identifiers-action-bundleid)
- [`capuchoo app list`](#capuchoo-app-list)
- [`capuchoo app revoke EMAIL`](#capuchoo-app-revoke-email)
- [`capuchoo app roles`](#capuchoo-app-roles)
- [`capuchoo auth issue`](#capuchoo-auth-issue)
- [`capuchoo auth keys`](#capuchoo-auth-keys)
- [`capuchoo auth login`](#capuchoo-auth-login)
- [`capuchoo auth logout`](#capuchoo-auth-logout)
- [`capuchoo auth revoke ID`](#capuchoo-auth-revoke-id)
- [`capuchoo auth whoami`](#capuchoo-auth-whoami)
- [`capuchoo channel create [NAME]`](#capuchoo-channel-create-name)
- [`capuchoo channel delete [NAME]`](#capuchoo-channel-delete-name)
- [`capuchoo channel list`](#capuchoo-channel-list)
- [`capuchoo config list`](#capuchoo-config-list)
- [`capuchoo config set KEY VALUE`](#capuchoo-config-set-key-value)
- [`capuchoo deploy native`](#capuchoo-deploy-native)
- [`capuchoo deploy ota`](#capuchoo-deploy-ota)
- [`capuchoo doctor`](#capuchoo-doctor)
- [`capuchoo help [COMMAND]`](#capuchoo-help-command)
- [`capuchoo init`](#capuchoo-init)
- [`capuchoo menu`](#capuchoo-menu)
- [`capuchoo org create [NAME]`](#capuchoo-org-create-name)
- [`capuchoo org invite EMAIL ROLE`](#capuchoo-org-invite-email-role)
- [`capuchoo org list`](#capuchoo-org-list)
- [`capuchoo org members`](#capuchoo-org-members)
- [`capuchoo setup`](#capuchoo-setup)
- [`capuchoo version bump TYPE`](#capuchoo-version-bump-type)
- [`capuchoo version sync`](#capuchoo-version-sync)

## `capuchoo app delete [APPID]`

Delete an app, its channels and its bundles

```
USAGE
  $ capuchoo app delete [APPID] [-y]

ARGUMENTS
  [APPID]  Bundle identifier of the app to delete

FLAGS
  -y, --yes  Skip the confirmation (scripts and CI)

DESCRIPTION
  Delete an app, its channels and its bundles

EXAMPLES
  $ capuchoo app delete com.company.app
```

_See code:
[src/commands/app/delete.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/app/delete.ts)_

## `capuchoo app grant EMAIL ROLE`

Give someone a role on this app

```
USAGE
  $ capuchoo app grant EMAIL ROLE

ARGUMENTS
  EMAIL  Account to grant
  ROLE   (admin|developer|tester|viewer) One of admin, developer, tester, viewer

DESCRIPTION
  Give someone a role on this app

EXAMPLES
  $ capuchoo app grant dev@company.com developer

  $ capuchoo app grant qa@company.com tester
```

_See code:
[src/commands/app/grant.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/app/grant.ts)_

## `capuchoo app identifiers [ACTION] [BUNDLEID]`

List, add or remove the bundle identifiers this app ships under

```
USAGE
  $ capuchoo app identifiers [ACTION] [BUNDLEID] [--flavour prod|staging|dev] [--platform android|ios|all] [-y]

ARGUMENTS
  [ACTION]    (list|add|remove) [default: list] list, add or remove
  [BUNDLEID]  Bundle identifier, for add and remove

FLAGS
  -y, --yes                Skip the confirmation
      --flavour=<option>   Which flavour ships under it. Omit when every flavour does, which turns the gate off.
                           <options: prod|staging|dev>
      --platform=<option>  android, ios, or all
                           <options: android|ios|all>

DESCRIPTION
  List, add or remove the bundle identifiers this app ships under

EXAMPLES
  $ capuchoo app identifiers

  $ capuchoo app identifiers add com.acme.app.dev --flavour dev

  $ capuchoo app identifiers remove com.acme.app.dev
```

_See code:
[src/commands/app/identifiers.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/app/identifiers.ts)_

## `capuchoo app list`

List the apps this account can reach

```
USAGE
  $ capuchoo app list [--json]

FLAGS
  --json  Machine-readable output

DESCRIPTION
  List the apps this account can reach
```

_See code:
[src/commands/app/list.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/app/list.ts)_

## `capuchoo app revoke EMAIL`

Remove someone's role on this app

```
USAGE
  $ capuchoo app revoke EMAIL [-y]

ARGUMENTS
  EMAIL  Account to revoke

FLAGS
  -y, --yes  Skip the confirmation

DESCRIPTION
  Remove someone's role on this app

EXAMPLES
  $ capuchoo app revoke dev@company.com
```

_See code:
[src/commands/app/revoke.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/app/revoke.ts)_

## `capuchoo app roles`

Show who can do what on this app

```
USAGE
  $ capuchoo app roles

DESCRIPTION
  Show who can do what on this app

EXAMPLES
  $ capuchoo app roles
```

_See code:
[src/commands/app/roles.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/app/roles.ts)_

## `capuchoo auth issue`

Create an API key, optionally limited to one app and one role

```
USAGE
  $ capuchoo auth issue [--name <value>] [--role viewer|tester|developer|admin] [--this-app]

FLAGS
  --name=<value>   Label shown in capuchoo auth keys
  --role=<option>  Ceiling on what the key may do: viewer, tester, developer, admin
                   <options: viewer|tester|developer|admin>
  --this-app       Restrict the key to the app this directory is linked to

DESCRIPTION
  Create an API key, optionally limited to one app and one role

EXAMPLES
  $ capuchoo auth issue --name ci --role developer --this-app

  $ capuchoo auth issue --name readonly --role viewer
```

_See code:
[src/commands/auth/issue.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/auth/issue.ts)_

## `capuchoo auth keys`

List the API keys on this account

```
USAGE
  $ capuchoo auth keys

DESCRIPTION
  List the API keys on this account

EXAMPLES
  $ capuchoo auth keys
```

_See code:
[src/commands/auth/keys.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/auth/keys.ts)_

## `capuchoo auth login`

Sign in to a Capuchoo backend

```
USAGE
  $ capuchoo auth login [-k <value>] [-e <value>]

FLAGS
  -e, --endpoint=<value>  Backend base URL
  -k, --api-key=<value>   API key from Settings > API Keys in the dashboard

DESCRIPTION
  Sign in to a Capuchoo backend

EXAMPLES
  $ capuchoo auth login

  $ capuchoo auth login --endpoint https://capucho.internal --api-key cap_...
```

_See code:
[src/commands/auth/login.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/auth/login.ts)_

## `capuchoo auth logout`

Remove the stored API key

```
USAGE
  $ capuchoo auth logout

DESCRIPTION
  Remove the stored API key
```

_See code:
[src/commands/auth/logout.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/auth/logout.ts)_

## `capuchoo auth revoke ID`

Revoke an API key

```
USAGE
  $ capuchoo auth revoke ID [-y]

ARGUMENTS
  ID  Key id, from capuchoo auth keys

FLAGS
  -y, --yes  Skip the confirmation

DESCRIPTION
  Revoke an API key

EXAMPLES
  $ capuchoo auth revoke <id>
```

_See code:
[src/commands/auth/revoke.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/auth/revoke.ts)_

## `capuchoo auth whoami`

Show the signed-in account, and the organizations and apps it can reach

```
USAGE
  $ capuchoo auth whoami [--json]

FLAGS
  --json  Machine-readable output

DESCRIPTION
  Show the signed-in account, and the organizations and apps it can reach
```

_See code:
[src/commands/auth/whoami.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/auth/whoami.ts)_

## `capuchoo channel create [NAME]`

Create a channel for this app

```
USAGE
  $ capuchoo channel create [NAME] [-e dev|staging|prod] [-y] [--json]

ARGUMENTS
  [NAME]  Name of the channel, e.g. staging

FLAGS
  -e, --environment=<option>  Which build flavour this channel serves
                              <options: dev|staging|prod>
  -y, --yes                   Accept the environment even when it disagrees with the name
      --json                  Machine-readable output

DESCRIPTION
  Create a channel for this app

EXAMPLES
  $ capuchoo channel create staging

  $ capuchoo channel create beta --environment staging

  $ capuchoo channel create prod --environment prod --yes
```

_See code:
[src/commands/channel/create.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/channel/create.ts)_

## `capuchoo channel delete [NAME]`

Delete one of this app's channels

```
USAGE
  $ capuchoo channel delete [NAME] [-y]

ARGUMENTS
  [NAME]  Name of the channel to delete

FLAGS
  -y, --yes  Skip the confirmation

DESCRIPTION
  Delete one of this app's channels

EXAMPLES
  $ capuchoo channel delete beta

  $ capuchoo channel delete beta --yes
```

_See code:
[src/commands/channel/delete.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/channel/delete.ts)_

## `capuchoo channel list`

List this app's channels and what they serve

```
USAGE
  $ capuchoo channel list [--json]

FLAGS
  --json  Machine-readable output

DESCRIPTION
  List this app's channels and what they serve
```

_See code:
[src/commands/channel/list.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/channel/list.ts)_

## `capuchoo config list`

Show the resolved configuration, and which build tools were found

```
USAGE
  $ capuchoo config list [--json]

FLAGS
  --json  Machine-readable output

DESCRIPTION
  Show the resolved configuration, and which build tools were found
```

_See code:
[src/commands/config/list.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/config/list.ts)_

## `capuchoo config set KEY VALUE`

Set a user preference in ~/.capuchoo/config.json

```
USAGE
  $ capuchoo config set KEY VALUE

ARGUMENTS
  KEY    (endpoint|defaultChannel) Preference to set
  VALUE  New value

DESCRIPTION
  Set a user preference in ~/.capuchoo/config.json

EXAMPLES
  $ capuchoo config set endpoint https://capucho.internal

  $ capuchoo config set defaultChannel staging
```

_See code:
[src/commands/config/set.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/config/set.ts)_

## `capuchoo deploy native`

Build and publish a native binary (APK). Users install it through the OS.

```
USAGE
  $ capuchoo deploy native [-c <value>] [-n <value>] [-v major|minor|patch] [-a] [-r] [--skip-assets]
    [--skip-build] [--dry-run] [--json] [--verbose] [-y] [-p android|ios] [-t debug|release] [--flavor <value>]
    [--allow-unsigned]

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
      --flavor=<value>     Gradle product flavour to build, when the project has more than one
      --json               Emit a machine-readable result on stdout
      --skip-assets        Do not regenerate launcher icons
      --skip-build         Publish the existing build output as-is
      --verbose            Stream build output to the terminal

DESCRIPTION
  Build and publish a native binary (APK). Users install it through the OS.

EXAMPLES
  $ capuchoo deploy native --channel staging

  $ capuchoo deploy native -c production -v minor --type release

  $ capuchoo deploy native -c staging --type debug -y
```

_See code:
[src/commands/deploy/native.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/deploy/native.ts)_

## `capuchoo deploy ota`

Publish a web bundle over the air. Does not change the installed binary.

```
USAGE
  $ capuchoo deploy ota [-c <value>] [-n <value>] [-v major|minor|patch] [-a] [-r] [--skip-assets]
    [--skip-build] [--dry-run] [--json] [--verbose] [-y]

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
  $ capuchoo deploy ota --channel staging

  $ capuchoo deploy ota -c production -v patch -n 'Fixes the invoice total'

  $ capuchoo deploy ota -c staging --dry-run
```

_See code:
[src/commands/deploy/ota.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/deploy/ota.ts)_

## `capuchoo doctor`

Check that this app, its credentials and its channels are usable

```
USAGE
  $ capuchoo doctor

DESCRIPTION
  Check that this app, its credentials and its channels are usable

EXAMPLES
  $ capuchoo doctor
```

_See code:
[src/commands/doctor.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/doctor.ts)_

## `capuchoo help [COMMAND]`

Display help for capuchoo.

```
USAGE
  $ capuchoo help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for capuchoo.
```

_See code:
[@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/6.2.58/src/commands/help.ts)_

## `capuchoo init`

Link this directory to a Capuchoo app and write .capuchoo/project.json

```
USAGE
  $ capuchoo init [-l | -c] [--name <value> ] [--app-id <value>] [--org <value> ] [--channel <value>] [-f]

FLAGS
  -c, --create           Create a new app instead of asking
  -f, --force            Overwrite an existing project.json
  -l, --link             Link an existing app instead of asking
      --app-id=<value>   Bundle identifier of the app, e.g. com.company.app
      --channel=<value>  Create this channel after linking, e.g. staging
      --name=<value>     Name of the app to create (default: this directory's name)
      --org=<value>      Organization to create the app in, by name or id

DESCRIPTION
  Link this directory to a Capuchoo app and write .capuchoo/project.json

EXAMPLES
  $ capuchoo init

  $ capuchoo init --link

  $ capuchoo init --create

  $ capuchoo init --create --name "My App" --app-id com.acme.app --channel staging
```

_See code:
[src/commands/init.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/init.ts)_

## `capuchoo menu`

Browse and run commands interactively

```
USAGE
  $ capuchoo menu

DESCRIPTION
  Browse and run commands interactively

EXAMPLES
  $ capuchoo

  $ capuchoo menu
```

_See code:
[src/commands/menu.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/menu.ts)_

## `capuchoo org create [NAME]`

Create an organization

```
USAGE
  $ capuchoo org create [NAME] [--json]

ARGUMENTS
  [NAME]  Display name of the organization

FLAGS
  --json  Machine-readable output

DESCRIPTION
  Create an organization

EXAMPLES
  $ capuchoo org create "SIG Service"

  $ capuchoo org create Acme --json
```

_See code:
[src/commands/org/create.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/org/create.ts)_

## `capuchoo org invite EMAIL ROLE`

Add an existing account to an organization

```
USAGE
  $ capuchoo org invite EMAIL ROLE [--org <value>]

ARGUMENTS
  EMAIL  Account to add
  ROLE   (owner|admin|member) One of owner, admin, member

FLAGS
  --org=<value>  Organization by name or id

DESCRIPTION
  Add an existing account to an organization

EXAMPLES
  $ capuchoo org invite dev@company.com member
```

_See code:
[src/commands/org/invite.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/org/invite.ts)_

## `capuchoo org list`

List the organizations this account belongs to

```
USAGE
  $ capuchoo org list [--json]

FLAGS
  --json  Machine-readable output

DESCRIPTION
  List the organizations this account belongs to
```

_See code:
[src/commands/org/list.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/org/list.ts)_

## `capuchoo org members`

List the people in an organization

```
USAGE
  $ capuchoo org members [--org <value>]

FLAGS
  --org=<value>  Organization by name or id

DESCRIPTION
  List the people in an organization

EXAMPLES
  $ capuchoo org members
```

_See code:
[src/commands/org/members.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/org/members.ts)_

## `capuchoo setup`

Install everything this app needs to receive updates

```
USAGE
  $ capuchoo setup [--native] [--skip-telemetry] [--skip-sync] [--dry-run] [-y]

FLAGS
  -y, --yes             Accept every prompt
      --dry-run         Report what would be installed, change nothing
      --native          Also install what downloading and installing an APK needs
      --skip-sync       Do not run cap sync afterwards
      --skip-telemetry  Do not install @capacitor/device

DESCRIPTION
  Install everything this app needs to receive updates

EXAMPLES
  $ capuchoo setup

  $ capuchoo setup --native

  $ capuchoo setup --dry-run
```

_See code:
[src/commands/setup.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/setup.ts)_

## `capuchoo version bump TYPE`

Raise the app's semantic version, and optionally an environment's build number

```
USAGE
  $ capuchoo version bump TYPE [-e dev|staging|prod]

ARGUMENTS
  TYPE  (major|minor|patch) Which part of the version to raise

FLAGS
  -e, --environment=<option>  Also increment this environment's native build number
                              <options: dev|staging|prod>

DESCRIPTION
  Raise the app's semantic version, and optionally an environment's build number

EXAMPLES
  $ capuchoo version bump patch

  $ capuchoo version bump minor --environment staging
```

_See code:
[src/commands/version/bump.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/version/bump.ts)_

## `capuchoo version sync`

Show, or advance, the version and build number used for each flavour

```
USAGE
  $ capuchoo version sync [-b] [-e dev|staging|prod] [--json]

FLAGS
  -b, --bump                  Increment the build number for the selected environments
  -e, --environment=<option>  Limit to one environment
                              <options: dev|staging|prod>
      --json                  Machine-readable output

DESCRIPTION
  Show, or advance, the version and build number used for each flavour

EXAMPLES
  $ capuchoo version sync

  $ capuchoo version sync --bump --environment staging
```

_See code:
[src/commands/version/sync.ts](https://github.com/aybinv7/capuchoo/blob/v0.9.1/src/commands/version/sync.ts)_
<!-- commandsstop -->
