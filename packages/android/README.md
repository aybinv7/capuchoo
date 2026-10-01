# Capuchoo for Android

Self-hosted updates for native Android apps - Kotlin, Java or the Android side of a Kotlin
Multiplatform app - installed outside Google Play. The app asks your Capuchoo server whether a newer
build is assigned to its channel, downloads it, verifies it and hands it to Android's installer.

It updates the APK as a whole. Kotlin and Java code cannot be replaced over the air; what changes
between releases without one is the channel's remote configuration (`Capuchoo.remoteConfig`).

## Install

`settings.gradle.kts`:

```kotlin
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven("https://jitpack.io")
    }
}
```

`app/build.gradle.kts`:

```kotlin
dependencies {
    implementation("com.github.aybinv7.capuchoo:capuchoo-android:android-v0.1.0")
}
```

Requires minSdk 26. The library's manifest adds `INTERNET` and `REQUEST_INSTALL_PACKAGES`.

## Configure

One value per flavour, so a dev build never asks the prod channel:

```kotlin
android {
    buildFeatures { buildConfig = true }
    defaultConfig {
        buildConfigField("String", "CAPUCHOO_ENDPOINT", "\"https://updates.example.com\"")
        buildConfigField("String", "CAPUCHOO_PUBLIC_KEY", "\"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\"")
    }
    flavorDimensions += "environment"
    productFlavors {
        create("dev") { buildConfigField("String", "CAPUCHOO_CHANNEL", "\"dev\"") }
        create("prod") { buildConfigField("String", "CAPUCHOO_CHANNEL", "\"prod\"") }
    }
}
```

The public key is the one `capuchoo keys show` prints. With it set, an APK that is not signed by
your release key is discarded before Android sees it.

```kotlin
class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Capuchoo.init(
            this,
            CapuchooConfig(
                endpoint = BuildConfig.CAPUCHOO_ENDPOINT,
                channel = BuildConfig.CAPUCHOO_CHANNEL,
                publicKey = BuildConfig.CAPUCHOO_PUBLIC_KEY,
                environment = BuildConfig.FLAVOR,
            ),
        )
    }
}
```

`init` checks once each time the app comes to the foreground (at most every 15 minutes), and
`Capuchoo.state` tells the UI what happened.

## Update

```kotlin
@Composable
fun UpdateBanner(scope: CoroutineScope = rememberCoroutineScope()) {
    val context = LocalContext.current
    when (val state = Capuchoo.state.collectAsState().value) {
        is UpdateState.Available -> Button(onClick = {
            if (!Capuchoo.canInstall()) context.startActivity(Capuchoo.installPermissionIntent())
            else scope.launch { runCatching { Capuchoo.install(Capuchoo.download(state.release)) } }
        }) { Text("Update to ${state.release.versionName}") }
        is UpdateState.Downloading -> LinearProgressIndicator(progress = { state.progress ?: 0f })
        is UpdateState.Failed -> Text(state.error.message.orEmpty())
        is UpdateState.Blocked -> Text(state.message)
        else -> Unit
    }
}
```

`state.release.required` means the user may not postpone it.

What `download` refuses, each time deleting the file:

- a checksum that differs from the one the server recorded;
- a missing or invalid release signature, when `publicKey` is set;
- an APK for another package, or one whose `versionCode` is not above the installed build.

`install` uses a `PackageInstaller` session. Android asks the user to confirm; from Android 12 an
app that installed the current build itself may update without the prompt. The first time, the user
must allow the app to install apps, which `installPermissionIntent()` opens.

## Publish

Build a signed release APK however you build it, then:

```sh
capuchoo deploy native --channel prod --apk app/build/outputs/apk/prod/release/app-prod-release.apk
```

The CLI reads the version from the APK itself and refuses a debuggable build on prod, an
unregistered `applicationId`, or a `versionCode` that devices already have. Deliver the same build
to a client channel with `capuchoo channel point prod-acme --native <versionCode>`.

## Release this library

Tag `android-v<version>` and push the tag. JitPack builds it from `jitpack.yml` at the repository
root the first time someone requests that version.

## Sample

`sample/` is a one-screen app that shows every update state and the two actions a user takes. It
reads its server from the git-ignored `sample/capuchoo.properties`:

```properties
endpoint=https://updates.example.com
channel=dev
publicKey=MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
```

From this directory: `capuchoo init`, `capuchoo keys init`, then
`capuchoo deploy native --channel dev --type debug -v auto` publishes a build. Install one, publish
the next, and press Update.
