# Trapeze and the native configuration step

`capuchoo deploy` applies native configuration in one step, and there are two halves to it.

**The built-in patcher always runs.** It writes what the CLI knows from the flavour's env file into
the native project: `applicationId`/`namespace`, `versionName`, `versionCode`, and the app name in
`strings.xml`. Nothing else sets those, and the version in particular has to reach the APK.

**Trapeze runs afterwards, when installed and configured.** It applies whatever the flavour's config
declares - manifest permissions, plist entries, anything the built-in patcher deliberately does not
attempt.

They used to be alternatives, and that was a bug worth remembering: a Trapeze config declaring only
a permission meant the version was never written, so a release published as v0.3.0 / code 5 shipped
an APK containing 0.2.1 / code 4. A device reports the version compiled into it, so it would install
that update, go on reporting the older code, be offered the same release again, and loop.

## Writing the config

```yaml
platforms:
  android:
    manifest:
      - file: AndroidManifest.xml
        target: manifest
        merge: |
          <manifest>
            <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
          </manifest>
```

Three things about that shape, each of which fails quietly if you get it wrong:

**`android` is a mapping, not a list.** Writing `- manifest:` makes every entry `android.<n>`, and
Trapeze answers

```
[warn] Unsupported configuration option android.0. Skipping
[info] No changes to apply
```

with **exit code 0**. The deploy used to report "Trapeze applied the flavour configuration" over the
top of that; it now reads the output and names the key it ignored.

**Use `merge`, not `inject`.** `inject` appends on every run, so a permission accumulates one line
per deploy and the manifest grows without bound. `merge` reconciles against what is already there -
verified idempotent across three consecutive runs.

**A permission declared only here does not exist without Trapeze.** If the binary is not installed,
the built-in patcher runs alone and cannot edit the manifest. `capuchoo init --native` adds
`REQUEST_INSTALL_PACKAGES` directly for that case, and `capuchoo doctor` fails when the in-app
install plugins are present without it.

## Why the permission matters

Without `REQUEST_INSTALL_PACKAGES`, an in-app native update downloads correctly and then silently
does nothing: `FileOpener.openFile` resolves whether or not an installer exists, so neither the app
nor the user learns anything. With it, Android asks the user to allow installs from this source - a
per-app grant no manifest can bypass, and the correct end of that path.
