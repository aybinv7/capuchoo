# @capuchoo/core

The contract shared by every part of [Capuchooo](https://github.com/aybinv7/capucho): the CLI, the
app-side runtime, the update server and the dashboard.

**Dependency-free on purpose, and it stays that way.** The CLI imports it in Node,
`@capuchoo/updater` imports it inside a Capacitor WebView, and the server imports it in its own
process. Nothing here touches the filesystem, the network, or a framework — a single dependency
would leak into all of them.

```sh
npm install @capuchoo/core
```

## What it contains

**The update contract** — `resolveUpdate()` narrows a server response into what the app should do,
and `isBlockingResponse()` separates "nothing to do" from a misconfiguration. That distinction
matters: a channel that does not exist, or a staging build pointed at a production channel, must not
be reported to the user as "you are up to date".

```ts
import { resolveUpdate, isBlockingResponse } from "@capuchoo/core";

const resolved = resolveUpdate(response); // native outranks OTA - the server may return both
if (isBlockingResponse(response)) {
  // Channel not found / environment mismatch: surface it, do not swallow it.
}
```

**Project configuration** — `normaliseProjectConfig()`, `validateProjectConfig()`,
`defaultFlavour()` and the `ENVIRONMENTS` list, so the CLI and the server agree on what a flavour
is.

**Environment isolation** — `environmentFromAppId()` and `isEnvironmentAllowed()` implement one rule
in one place: a staging build may only see staging channels, while a production build may also read
a staging channel (deliberately, for beta testing). The server enforces the same rule with the same
function.

**Versioning** — `bumpVersion()`, `compareVersions()`, `parseVersion()`, `nextVersionCode()`. Used
by the CLI instead of `npm version`, which resolves the nearest `package.json` from the process
directory and would bump the wrong one inside a workspace.

## Stability

Pre-1.0: the surface may change between minor versions. It is published because `@capuchoo/updater`
and `@capuchoo/cli` depend on it, not as a general-purpose library.
