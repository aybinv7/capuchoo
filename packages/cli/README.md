@capuchoo/cli
=============

Capuchoo CLI bundles and uploads your application to the cloud. It packages builds as native
artifacts or ZIP files, then publishes them using user-defined parameters such as channels and
custom release options. Built for simple, repeatable deployments, it integrates cleanly into local
workflows and CI pipelines to ship updates quickly and reliably.

For team release operations, version ownership, GitHub Actions integration, and ecosystem
boundaries, see [CI releases](docs/ci-releases.md).

Since 0.16: a release is built and uploaded once, then delivered to other channels with
`capuchoo channel point` (client channels, pause, rollback, history); OTA bundles and APKs are
signed with the key from `capuchoo keys init`; native deploys refuse debug or unsigned APKs on prod
and client channels and pin the APK signing certificate; a flavour build refuses `VITE_*` values
leaking in from `.env` / `.env.local`; `capuchoo ci init --gitlab` writes a GitLab pipeline.

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
@capuchoo/cli/0.16.0 win32-x64 node-v24.21.0
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
- [`capuchoo channel history CHANNEL`](#capuchoo-channel-history-channel)
- [`capuchoo channel list`](#capuchoo-channel-list)
- [`capuchoo channel pause CHANNEL`](#capuchoo-channel-pause-channel)
- [`capuchoo channel point CHANNEL`](#capuchoo-channel-point-channel)
- [`capuchoo channel resume CHANNEL`](#capuchoo-channel-resume-channel)
- [`capuchoo ci init`](#capuchoo-ci-init)
- [`capuchoo config list`](#capuchoo-config-list)
- [`capuchoo config set KEY VALUE`](#capuchoo-config-set-key-value)
- [`capuchoo deploy native`](#capuchoo-deploy-native)
- [`capuchoo deploy ota`](#capuchoo-deploy-ota)
- [`capuchoo doctor`](#capuchoo-doctor)
- [`capuchoo help [COMMAND]`](#capuchoo-help-command)
- [`capuchoo init`](#capuchoo-init)
- [`capuchoo keys init`](#capuchoo-keys-init)
- [`capuchoo keys show`](#capuchoo-keys-show)
- [`capuchoo menu`](#capuchoo-menu)
- [`capuchoo org create [NAME]`](#capuchoo-org-create-name)
- [`capuchoo org invite EMAIL ROLE`](#capuchoo-org-invite-email-role)
- [`capuchoo org list`](#capuchoo-org-list)
- [`capuchoo org members`](#capuchoo-org-members)
- [`capuchoo release list`](#capuchoo-release-list)
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
[src/commands/app/delete.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/app/delete.ts)_

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
[src/commands/app/grant.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/app/grant.ts)_

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
[src/commands/app/identifiers.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/app/identifiers.ts)_

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
[src/commands/app/list.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/app/list.ts)_

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
[src/commands/app/revoke.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/app/revoke.ts)_

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
[src/commands/app/roles.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/app/roles.ts)_

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
[src/commands/auth/issue.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/auth/issue.ts)_

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
[src/commands/auth/keys.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/auth/keys.ts)_

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
[src/commands/auth/login.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/auth/login.ts)_

## `capuchoo auth logout`

Remove the stored API key

```
USAGE
  $ capuchoo auth logout

DESCRIPTION
  Remove the stored API key
```

_See code:
[src/commands/auth/logout.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/auth/logout.ts)_

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
[src/commands/auth/revoke.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/auth/revoke.ts)_

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
[src/commands/auth/whoami.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/auth/whoami.ts)_

## `capuchoo channel create [NAME]`

Create a channel for this app

```
USAGE
  $ capuchoo channel create [NAME] [-e dev|staging|prod] [-y] [--base <value> --client] [--json]

ARGUMENTS
  [NAME]  Name of the channel, e.g. staging

FLAGS
  -e, --environment=<option>  Which build flavour this channel serves
                              <options: dev|staging|prod>
  -y, --yes                   Accept the environment even when it disagrees with the name
      --base=<value>          Release channel a client channel follows, e.g. prod
      --client                A client channel: takes no uploads, only releases its base channel has served
      --json                  Machine-readable output

DESCRIPTION
  Create a channel for this app

EXAMPLES
  $ capuchoo channel create staging

  $ capuchoo channel create beta --environment staging

  $ capuchoo channel create prod --environment prod --yes

  $ capuchoo channel create prod-acme --client --base prod
```

_See code:
[src/commands/channel/create.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/channel/create.ts)_

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
[src/commands/channel/delete.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/channel/delete.ts)_

## `capuchoo channel history CHANNEL`

Show every pointer move, pause and rollback on a channel, newest first

```
USAGE
  $ capuchoo channel history CHANNEL [--limit <value>] [--json]

ARGUMENTS
  CHANNEL  Channel to inspect

FLAGS
  --json           Machine-readable output
  --limit=<value>  [default: 20] How many moves to show

DESCRIPTION
  Show every pointer move, pause and rollback on a channel, newest first
```

_See code:
[src/commands/channel/history.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/channel/history.ts)_

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
[src/commands/channel/list.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/channel/list.ts)_

## `capuchoo channel pause CHANNEL`

Stop a channel serving anything until it is resumed

```
USAGE
  $ capuchoo channel pause CHANNEL [-y] [--json]

ARGUMENTS
  CHANNEL  Channel to pause

FLAGS
  -y, --yes   Do not ask for confirmation
      --json  Machine-readable output

DESCRIPTION
  Stop a channel serving anything until it is resumed
```

_See code:
[src/commands/channel/pause.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/channel/pause.ts)_

## `capuchoo channel point CHANNEL`

Deliver an already published release to a channel by moving its pointer; nothing is rebuilt

```
USAGE
  $ capuchoo channel point CHANNEL --version <value> [--native <value>] [--platform android|ios] [--rollback]
    [--reason <value>] [-y] [--json]

ARGUMENTS
  CHANNEL  Channel to point, e.g. prod-acme

FLAGS
  -y, --yes                Do not ask for confirmation
      --json               Machine-readable output
      --native=<value>     Native build number (versionCode) to deliver as well
      --platform=<option>  [default: android]
                           <options: android|ios>
      --reason=<value>     Why, recorded in the channel history
      --rollback           Move to a lower version; devices accept the downgrade
      --version=<value>    (required) Version to deliver. Selects the OTA bundle, and the native build with --native

DESCRIPTION
  Deliver an already published release to a channel by moving its pointer; nothing is rebuilt

EXAMPLES
  $ capuchoo channel point prod-acme --version 2.4.0

  $ capuchoo channel point prod --version 2.4.0 --native 57

  $ capuchoo channel point prod --version 2.3.1 --rollback --reason "crash on login"
```

_See code:
[src/commands/channel/point.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/channel/point.ts)_

## `capuchoo channel resume CHANNEL`

Let a paused channel serve its releases again

```
USAGE
  $ capuchoo channel resume CHANNEL [--json]

ARGUMENTS
  CHANNEL  Channel to resume

FLAGS
  --json  Machine-readable output

DESCRIPTION
  Let a paused channel serve its releases again
```

_See code:
[src/commands/channel/resume.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/channel/resume.ts)_

## `capuchoo ci init`

Write a GitLab pipeline that publishes to prod once and delivers to each client by hand

```
USAGE
  $ capuchoo ci init [--gitlab] [--clients <value>] [--output <value>] [-y] [--json]

FLAGS
  -y, --yes              Replace an existing file without asking
      --clients=<value>  Comma-separated clients; each gets a manual deliver job to prod-<client>
      --gitlab           Generate .gitlab-ci.yml
      --json             Machine-readable output
      --output=<value>   [default: .gitlab-ci.yml] Where to write the pipeline

DESCRIPTION
  Write a GitLab pipeline that publishes to prod once and delivers to each client by hand

EXAMPLES
  $ capuchoo ci init --gitlab

  $ capuchoo ci init --gitlab --clients acme,globex

  $ capuchoo ci init --gitlab --clients acme --output ../../.gitlab-ci.yml --yes
```

_See code:
[src/commands/ci/init.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/ci/init.ts)_

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
[src/commands/config/list.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/config/list.ts)_

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
[src/commands/config/set.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/config/set.ts)_

## `capuchoo deploy native`

Build and publish a native binary (APK). Users install it through the OS.

```
USAGE
  $ capuchoo deploy native [-c <value>] [-n <value>] [-v major|minor|patch] [-a] [-r] [--skip-assets]
    [--skip-build] [--dry-run] [--json] [--verbose] [-y] [--allow-local-env] [-p android|ios] [-t debug|release]
    [--flavor <value>] [--allow-unsigned] [--allow-cert-change]

FLAGS
  -a, --[no-]active        Serve this release immediately
  -c, --channel=<value>    Channel to publish to. Its environment selects the flavour.
  -n, --note=<value>       Release notes shown to users
  -p, --platform=<option>  [default: android] Target platform
                           <options: android|ios>
  -r, --[no-]required      Users cannot postpone this release
  -t, --type=<option>      Gradle variant to assemble. Defaults to release; debug is refused on prod and client channels
                           <options: debug|release>
  -v, --version=<option>   Bump the app version before publishing
                           <options: major|minor|patch>
  -y, --yes                Accept every prompt - required in CI
      --allow-cert-change  Publish an APK signed with a different certificate than the previous release. Installed
                           devices cannot upgrade to it.
      --allow-local-env    Build even when .env / .env.local define VITE_* keys the flavour file does not, shipping this
                           machine's values
      --allow-unsigned     Publish a release build with no signature, to a dev channel only. Android will refuse to
                           install it.
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
[src/commands/deploy/native.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/deploy/native.ts)_

## `capuchoo deploy ota`

Publish a web bundle over the air. Does not change the installed binary.

```
USAGE
  $ capuchoo deploy ota [-c <value>] [-n <value>] [-v major|minor|patch] [-a] [-r] [--skip-assets]
    [--skip-build] [--dry-run] [--json] [--verbose] [-y] [--allow-local-env] [--min-native <value>]

FLAGS
  -a, --[no-]active         Serve this release immediately
  -c, --channel=<value>     Channel to publish to. Its environment selects the flavour.
  -n, --note=<value>        Release notes shown to users
  -r, --[no-]required       Users cannot postpone this release
  -v, --version=<option>    Bump the app version before publishing
                            <options: major|minor|patch>
  -y, --yes                 Accept every prompt - required in CI
      --allow-local-env     Build even when .env / .env.local define VITE_* keys the flavour file does not, shipping
                            this machine's values
      --dry-run             Build and package, but upload nothing
      --json                Emit a machine-readable result on stdout
      --min-native=<value>  Native build number this bundle needs. Devices below it are offered the binary instead.
      --skip-assets         Do not regenerate launcher icons
      --skip-build          Publish the existing build output as-is
      --verbose             Stream build output to the terminal

DESCRIPTION
  Publish a web bundle over the air. Does not change the installed binary.

EXAMPLES
  $ capuchoo deploy ota --channel staging

  $ capuchoo deploy ota -c production -v patch -n 'Fixes the invoice total'

  $ capuchoo deploy ota -c staging --dry-run

  $ capuchoo deploy ota -c dev --min-native 10
```

_See code:
[src/commands/deploy/ota.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/deploy/ota.ts)_

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
[src/commands/doctor.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/doctor.ts)_

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

Set this app up to receive updates, from nothing to verified

```
USAGE
  $ capuchoo init [-l | -c] [--name <value> ] [--app-id <value>] [--org <value> ] [--channel <value>] [-f]
    [-y] [--dry-run] [--native] [--skip-telemetry] [--skip-sync] [--skip <value>...] [--only <value>...] [--prove]

FLAGS
  -c, --create           Create a new app instead of asking
  -f, --force            Overwrite an existing project.json
  -l, --link             Link an existing app instead of asking
  -y, --yes              Apply every change without asking
      --app-id=<value>   Bundle identifier of the app, e.g. com.company.app
      --channel=<value>  Create this channel after linking, e.g. staging
      --dry-run          Report the wiring changes without writing (needs a linked directory)
      --name=<value>     Name of the app to create (default: this directory's name)
      --native           Also install what downloading and installing an APK needs
      --only=<value>...  Run only these steps (verify always runs unless skipped)
      --org=<value>      Organization to create the app in, by name or id
      --prove            Publish a release and wait for a device to take it
      --skip=<value>...  Steps to leave out: credentials, link, identifiers, channels, packages, env, code, verify,
                         publish, confirm
      --skip-sync        Do not run cap sync after installing
      --skip-telemetry   Do not install @capacitor/device

DESCRIPTION
  Set this app up to receive updates, from nothing to verified

ALIASES
  $ capuchoo setup

EXAMPLES
  $ capuchoo init

  $ capuchoo init --yes

  $ capuchoo init --dry-run

  $ capuchoo init --only env --only code

  $ capuchoo init --create --name "My App" --app-id com.acme.app
```

_See code:
[src/commands/init.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/init.ts)_

## `capuchoo keys init`

Create this app's release signing key, git-ignore it, and upload its public key

```
USAGE
  $ capuchoo keys init [--require-signature] [--force] [-y] [--json]

FLAGS
  -y, --yes                     Accept every prompt
      --force                   Replace an existing key. Builds that bake the old public key reject everything the new
                                one signs
      --json                    Machine-readable output
      --[no-]require-signature  Make the server refuse unsigned uploads for this app

DESCRIPTION
  Create this app's release signing key, git-ignore it, and upload its public key

EXAMPLES
  $ capuchoo keys init

  $ capuchoo keys init --yes --json

  $ capuchoo keys init --no-require-signature

  $ capuchoo keys init --force
```

_See code:
[src/commands/keys/init.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/keys/init.ts)_

## `capuchoo keys show`

Show the release signing key's fingerprint and whether each flavour bakes its public key

```
USAGE
  $ capuchoo keys show [--json]

FLAGS
  --json  Machine-readable output

DESCRIPTION
  Show the release signing key's fingerprint and whether each flavour bakes its public key
```

_See code:
[src/commands/keys/show.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/keys/show.ts)_

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
[src/commands/menu.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/menu.ts)_

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
[src/commands/org/create.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/org/create.ts)_

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
[src/commands/org/invite.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/org/invite.ts)_

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
[src/commands/org/list.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/org/list.ts)_

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
[src/commands/org/members.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/org/members.ts)_

## `capuchoo release list`

List published bundles and native builds, or only what one channel has served

```
USAGE
  $ capuchoo release list [-c <value>] [--limit <value>] [--json]

FLAGS
  -c, --channel=<value>  Only releases this channel has served
      --json             Machine-readable output
      --limit=<value>    [default: 30] How many to show

DESCRIPTION
  List published bundles and native builds, or only what one channel has served

EXAMPLES
  $ capuchoo release list

  $ capuchoo release list --channel prod-acme --json
```

_See code:
[src/commands/release/list.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/release/list.ts)_

## `capuchoo setup`

Set this app up to receive updates, from nothing to verified

```
USAGE
  $ capuchoo setup [-l | -c] [--name <value> ] [--app-id <value>] [--org <value> ] [--channel <value>] [-f]
    [-y] [--dry-run] [--native] [--skip-telemetry] [--skip-sync] [--skip <value>...] [--only <value>...] [--prove]

FLAGS
  -c, --create           Create a new app instead of asking
  -f, --force            Overwrite an existing project.json
  -l, --link             Link an existing app instead of asking
  -y, --yes              Apply every change without asking
      --app-id=<value>   Bundle identifier of the app, e.g. com.company.app
      --channel=<value>  Create this channel after linking, e.g. staging
      --dry-run          Report the wiring changes without writing (needs a linked directory)
      --name=<value>     Name of the app to create (default: this directory's name)
      --native           Also install what downloading and installing an APK needs
      --only=<value>...  Run only these steps (verify always runs unless skipped)
      --org=<value>      Organization to create the app in, by name or id
      --prove            Publish a release and wait for a device to take it
      --skip=<value>...  Steps to leave out: credentials, link, identifiers, channels, packages, env, code, verify,
                         publish, confirm
      --skip-sync        Do not run cap sync after installing
      --skip-telemetry   Do not install @capacitor/device

DESCRIPTION
  Set this app up to receive updates, from nothing to verified

ALIASES
  $ capuchoo setup

EXAMPLES
  $ capuchoo init

  $ capuchoo init --yes

  $ capuchoo init --dry-run

  $ capuchoo init --only env --only code

  $ capuchoo init --create --name "My App" --app-id com.acme.app
```

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
[src/commands/version/bump.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/version/bump.ts)_

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
[src/commands/version/sync.ts](https://github.com/aybinv7/capuchoo/blob/v0.16.0/src/commands/version/sync.ts)_
<!-- commandsstop -->
