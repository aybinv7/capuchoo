capucho-cli
=================

Capucho CLI bundles and uploads your application to the cloud. It packages builds as native artifacts or ZIP files, then publishes them using user-defined parameters such as channels and custom release options. Built for simple, repeatable deployments, it integrates cleanly into local workflows and CI pipelines to ship updates quickly and reliably.

For team release operations, version ownership, GitHub Actions integration, and ecosystem boundaries, see [CI releases](docs/ci-releases.md).


[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/capucho-cli.svg)](https://npmjs.org/package/capucho-cli)
[![Downloads/week](https://img.shields.io/npm/dw/capucho-cli.svg)](https://npmjs.org/package/capucho-cli)


<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g capucho-cli
$ capucho-cli COMMAND
running command...
$ capucho-cli (--version)
capucho-cli/0.1.0 win32-x64 node-v26.4.0
$ capucho-cli --help [COMMAND]
USAGE
  $ capucho-cli COMMAND
...
```
<!-- usagestop -->
```sh-session
$ npm install -g capucho-cli
$ capucho-cli COMMAND
running command...
$ capucho-cli (--version)
capucho-cli/0.0.0 win32-x64 node-v24.1.0
$ capucho-cli --help [COMMAND]
USAGE
  $ capucho-cli COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`capucho-cli auth login`](#capucho-cli-auth-login)
* [`capucho-cli auth logout`](#capucho-cli-auth-logout)
* [`capucho-cli auth whoami`](#capucho-cli-auth-whoami)
* [`capucho-cli channel create`](#capucho-cli-channel-create)
* [`capucho-cli channel list`](#capucho-cli-channel-list)
* [`capucho-cli channel promote`](#capucho-cli-channel-promote)
* [`capucho-cli config init`](#capucho-cli-config-init)
* [`capucho-cli config list`](#capucho-cli-config-list)
* [`capucho-cli config set KEY VALUE`](#capucho-cli-config-set-key-value)
* [`capucho-cli deploy native`](#capucho-cli-deploy-native)
* [`capucho-cli deploy ota`](#capucho-cli-deploy-ota)
* [`capucho-cli deploy rollback`](#capucho-cli-deploy-rollback)
* [`capucho-cli hello PERSON`](#capucho-cli-hello-person)
* [`capucho-cli hello world`](#capucho-cli-hello-world)
* [`capucho-cli help [COMMAND]`](#capucho-cli-help-command)
* [`capucho-cli init`](#capucho-cli-init)
* [`capucho-cli plugins`](#capucho-cli-plugins)
* [`capucho-cli plugins add PLUGIN`](#capucho-cli-plugins-add-plugin)
* [`capucho-cli plugins:inspect PLUGIN...`](#capucho-cli-pluginsinspect-plugin)
* [`capucho-cli plugins install PLUGIN`](#capucho-cli-plugins-install-plugin)
* [`capucho-cli plugins link PATH`](#capucho-cli-plugins-link-path)
* [`capucho-cli plugins remove [PLUGIN]`](#capucho-cli-plugins-remove-plugin)
* [`capucho-cli plugins reset`](#capucho-cli-plugins-reset)
* [`capucho-cli plugins uninstall [PLUGIN]`](#capucho-cli-plugins-uninstall-plugin)
* [`capucho-cli plugins unlink [PLUGIN]`](#capucho-cli-plugins-unlink-plugin)
* [`capucho-cli plugins update`](#capucho-cli-plugins-update)
* [`capucho-cli version bump TYPE`](#capucho-cli-version-bump-type)
* [`capucho-cli version sync`](#capucho-cli-version-sync)

## `capucho-cli auth login`

Authenticate with Capucho platform using an API key

```
USAGE
  $ capucho-cli auth login [-k <value>] [-e <value>]

FLAGS
  -e, --endpoint=<value>  API endpoint
  -k, --api-key=<value>   API key (get from Settings > API Keys in dashboard)

DESCRIPTION
  Authenticate with Capucho platform using an API key

EXAMPLES
  $ capucho-cli auth login

  $ capucho-cli auth login --api-key cap_xxxx

  $ capucho-cli auth login --endpoint https://your-server.com
```

_See code: [src/commands/auth/login.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/auth/login.ts)_

## `capucho-cli auth logout`

Log out and clear credentials

```
USAGE
  $ capucho-cli auth logout

DESCRIPTION
  Log out and clear credentials
```

_See code: [src/commands/auth/logout.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/auth/logout.ts)_

## `capucho-cli auth whoami`

Show current logged in user and available apps

```
USAGE
  $ capucho-cli auth whoami

DESCRIPTION
  Show current logged in user and available apps
```

_See code: [src/commands/auth/whoami.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/auth/whoami.ts)_

## `capucho-cli channel create`

Create a new channel

```
USAGE
  $ capucho-cli channel create

DESCRIPTION
  Create a new channel
```

_See code: [src/commands/channel/create.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/channel/create.ts)_

## `capucho-cli channel list`

List available channels

```
USAGE
  $ capucho-cli channel list

DESCRIPTION
  List available channels
```

_See code: [src/commands/channel/list.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/channel/list.ts)_

## `capucho-cli channel promote`

Promote a release to another channel

```
USAGE
  $ capucho-cli channel promote

DESCRIPTION
  Promote a release to another channel
```

_See code: [src/commands/channel/promote.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/channel/promote.ts)_

## `capucho-cli config init`

Initialize Capucho CLI configuration in your project

```
USAGE
  $ capucho-cli config init

DESCRIPTION
  Initialize Capucho CLI configuration in your project

EXAMPLES
  $ capucho-cli config init
```

_See code: [src/commands/config/init.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/config/init.ts)_

## `capucho-cli config list`

List current configuration

```
USAGE
  $ capucho-cli config list

DESCRIPTION
  List current configuration
```

_See code: [src/commands/config/list.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/config/list.ts)_

## `capucho-cli config set KEY VALUE`

Set a configuration value

```
USAGE
  $ capucho-cli config set KEY VALUE [-g]

ARGUMENTS
  KEY    Config key (e.g. apiKey, defaultEnvironment)
  VALUE  Config value

FLAGS
  -g, --global  Set in global config

DESCRIPTION
  Set a configuration value
```

_See code: [src/commands/config/set.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/config/set.ts)_

## `capucho-cli deploy native`

Deploy a native update (APK/IPA) to your project

```
USAGE
  $ capucho-cli deploy native [-a] [-c <value>] [-n <value>] [-p android|ios] [-t debug|release] [-r] [-s]
    [--skipBuild] [--githubPages] [-v major|minor|patch] [--verbose] [-y]

FLAGS
  -a, --[no-]active        Activate update immediately
  -c, --channel=<value>    Release channel
  -n, --note=<value>       Release notes
  -p, --platform=<option>  [default: android] Target platform
                           <options: android|ios>
  -r, --[no-]required      Mark as required update
  -s, --skipAsset          Skip asset generation
  -t, --type=<option>      Build type (debug for unsigned, release for signed)
                           <options: debug|release>
  -v, --version=<option>   Version bump type
                           <options: major|minor|patch>
  -y, --yes                Skip confirmation prompts
      --githubPages        Publish generated assets to the configured GitHub Pages repository
      --skipBuild          Skip build step
      --verbose            Show detailed output from build steps

DESCRIPTION
  Deploy a native update (APK/IPA) to your project
```

_See code: [src/commands/deploy/native.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/deploy/native.ts)_

## `capucho-cli deploy ota`

Deploy an OTA update to your project

```
USAGE
  $ capucho-cli deploy ota [-a] [-c <value>] [-n <value>] [-r] [-s] [--skipBuild] [--githubPages] [-v
    major|minor|patch] [--verbose] [-y]

FLAGS
  -a, --[no-]active       Activate update immediately
  -c, --channel=<value>   Release channel
  -n, --note=<value>      Release notes
  -r, --[no-]required     Mark as required update
  -s, --skipAsset         Skip asset generation
  -v, --version=<option>  Version bump type
                          <options: major|minor|patch>
  -y, --yes               Skip confirmation prompts
      --githubPages       Publish generated assets to the configured GitHub Pages repository
      --skipBuild         Skip build step
      --verbose           Show detailed output from build steps

DESCRIPTION
  Deploy an OTA update to your project

EXAMPLES
  $ capucho-cli deploy ota -c staging -v patch

  $ capucho-cli deploy ota --note "Critical fix"
```

_See code: [src/commands/deploy/ota.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/deploy/ota.ts)_

## `capucho-cli deploy rollback`

Rollback to a previous version

```
USAGE
  $ capucho-cli deploy rollback

DESCRIPTION
  Rollback to a previous version
```

_See code: [src/commands/deploy/rollback.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/deploy/rollback.ts)_

## `capucho-cli hello PERSON`

Say hello

```
USAGE
  $ capucho-cli hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ capucho-cli hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/hello/index.ts)_

## `capucho-cli hello world`

Say hello world

```
USAGE
  $ capucho-cli hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ capucho-cli hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/hello/world.ts)_

## `capucho-cli help [COMMAND]`

Display help for capucho-cli.

```
USAGE
  $ capucho-cli help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for capucho-cli.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.36/src/commands/help.ts)_

## `capucho-cli init`

Initialize Capucho in this project

```
USAGE
  $ capucho-cli init [-l]

FLAGS
  -l, --link  Link to existing app instead of creating new one

DESCRIPTION
  Initialize Capucho in this project
```

_See code: [src/commands/init.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/init.ts)_

## `capucho-cli plugins`

List installed plugins.

```
USAGE
  $ capucho-cli plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ capucho-cli plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.54/src/commands/plugins/index.ts)_

## `capucho-cli plugins add PLUGIN`

Installs a plugin into capucho-cli.

```
USAGE
  $ capucho-cli plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into capucho-cli.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the CAPUCHO_CLI_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the CAPUCHO_CLI_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ capucho-cli plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ capucho-cli plugins add myplugin

  Install a plugin from a github url.

    $ capucho-cli plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ capucho-cli plugins add someuser/someplugin
```

## `capucho-cli plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ capucho-cli plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ capucho-cli plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.54/src/commands/plugins/inspect.ts)_

## `capucho-cli plugins install PLUGIN`

Installs a plugin into capucho-cli.

```
USAGE
  $ capucho-cli plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into capucho-cli.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the CAPUCHO_CLI_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the CAPUCHO_CLI_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ capucho-cli plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ capucho-cli plugins install myplugin

  Install a plugin from a github url.

    $ capucho-cli plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ capucho-cli plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.54/src/commands/plugins/install.ts)_

## `capucho-cli plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ capucho-cli plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ capucho-cli plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.54/src/commands/plugins/link.ts)_

## `capucho-cli plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ capucho-cli plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ capucho-cli plugins unlink
  $ capucho-cli plugins remove

EXAMPLES
  $ capucho-cli plugins remove myplugin
```

## `capucho-cli plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ capucho-cli plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.54/src/commands/plugins/reset.ts)_

## `capucho-cli plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ capucho-cli plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ capucho-cli plugins unlink
  $ capucho-cli plugins remove

EXAMPLES
  $ capucho-cli plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.54/src/commands/plugins/uninstall.ts)_

## `capucho-cli plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ capucho-cli plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ capucho-cli plugins unlink
  $ capucho-cli plugins remove

EXAMPLES
  $ capucho-cli plugins unlink myplugin
```

## `capucho-cli plugins update`

Update installed plugins.

```
USAGE
  $ capucho-cli plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.54/src/commands/plugins/update.ts)_

## `capucho-cli version bump TYPE`

Bump version and sync to env files

```
USAGE
  $ capucho-cli version bump TYPE [-e dev|staging|prod] [--git-tag-version]

ARGUMENTS
  TYPE  (major|minor|patch) Version bump type (major, minor, patch)

FLAGS
  -e, --environment=<option>  Environment whose version code is incremented
                              <options: dev|staging|prod>
      --[no-]git-tag-version  Create a git tag

DESCRIPTION
  Bump version and sync to env files
```

_See code: [src/commands/version/bump.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/version/bump.ts)_

## `capucho-cli version sync`

Sync version from package.json to environment files

```
USAGE
  $ capucho-cli version sync [-b] [-e <value>]

FLAGS
  -b, --bump                 Bump version code
  -e, --environment=<value>  Target environment (dev, staging, prod)

DESCRIPTION
  Sync version from package.json to environment files
```

_See code: [src/commands/version/sync.ts](https://github.com/inventor7/capucho-cli/blob/v0.1.0/src/commands/version/sync.ts)_
<!-- commandsstop -->
* [`capucho-cli hello PERSON`](#capucho-cli-hello-person)
* [`capucho-cli hello world`](#capucho-cli-hello-world)
* [`capucho-cli help [COMMAND]`](#capucho-cli-help-command)
* [`capucho-cli plugins`](#capucho-cli-plugins)
* [`capucho-cli plugins add PLUGIN`](#capucho-cli-plugins-add-plugin)
* [`capucho-cli plugins:inspect PLUGIN...`](#capucho-cli-pluginsinspect-plugin)
* [`capucho-cli plugins install PLUGIN`](#capucho-cli-plugins-install-plugin)
* [`capucho-cli plugins link PATH`](#capucho-cli-plugins-link-path)
* [`capucho-cli plugins remove [PLUGIN]`](#capucho-cli-plugins-remove-plugin)
* [`capucho-cli plugins reset`](#capucho-cli-plugins-reset)
* [`capucho-cli plugins uninstall [PLUGIN]`](#capucho-cli-plugins-uninstall-plugin)
* [`capucho-cli plugins unlink [PLUGIN]`](#capucho-cli-plugins-unlink-plugin)
* [`capucho-cli plugins update`](#capucho-cli-plugins-update)

## `capucho-cli hello PERSON`

Say hello

```
USAGE
  $ capucho-cli hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ capucho-cli hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/inventor7/capucho-cli/blob/v0.0.0/src/commands/hello/index.ts)_

## `capucho-cli hello world`

Say hello world

```
USAGE
  $ capucho-cli hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ capucho-cli hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/inventor7/capucho-cli/blob/v0.0.0/src/commands/hello/world.ts)_

## `capucho-cli help [COMMAND]`

Display help for capucho-cli.

```
USAGE
  $ capucho-cli help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for capucho-cli.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.36/src/commands/help.ts)_

## `capucho-cli plugins`

List installed plugins.

```
USAGE
  $ capucho-cli plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ capucho-cli plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.54/src/commands/plugins/index.ts)_

## `capucho-cli plugins add PLUGIN`

Installs a plugin into capucho-cli.

```
USAGE
  $ capucho-cli plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into capucho-cli.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the CAPUCHO_CLI_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the CAPUCHO_CLI_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ capucho-cli plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ capucho-cli plugins add myplugin

  Install a plugin from a github url.

    $ capucho-cli plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ capucho-cli plugins add someuser/someplugin
```

## `capucho-cli plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ capucho-cli plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ capucho-cli plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.54/src/commands/plugins/inspect.ts)_

## `capucho-cli plugins install PLUGIN`

Installs a plugin into capucho-cli.

```
USAGE
  $ capucho-cli plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into capucho-cli.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the CAPUCHO_CLI_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the CAPUCHO_CLI_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ capucho-cli plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ capucho-cli plugins install myplugin

  Install a plugin from a github url.

    $ capucho-cli plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ capucho-cli plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.54/src/commands/plugins/install.ts)_

## `capucho-cli plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ capucho-cli plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ capucho-cli plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.54/src/commands/plugins/link.ts)_

## `capucho-cli plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ capucho-cli plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ capucho-cli plugins unlink
  $ capucho-cli plugins remove

EXAMPLES
  $ capucho-cli plugins remove myplugin
```

## `capucho-cli plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ capucho-cli plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.54/src/commands/plugins/reset.ts)_

## `capucho-cli plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ capucho-cli plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ capucho-cli plugins unlink
  $ capucho-cli plugins remove

EXAMPLES
  $ capucho-cli plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.54/src/commands/plugins/uninstall.ts)_

## `capucho-cli plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ capucho-cli plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ capucho-cli plugins unlink
  $ capucho-cli plugins remove

EXAMPLES
  $ capucho-cli plugins unlink myplugin
```

## `capucho-cli plugins update`

Update installed plugins.

```
USAGE
  $ capucho-cli plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.54/src/commands/plugins/update.ts)_
<!-- commandsstop -->
