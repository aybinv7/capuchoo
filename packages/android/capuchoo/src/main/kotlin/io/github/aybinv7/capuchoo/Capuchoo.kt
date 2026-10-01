package io.github.aybinv7.capuchoo

import android.content.Context
import android.content.Intent
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.flow.StateFlow

/**
 * Self-hosted native updates for an Android app.
 *
 * ```
 * Capuchoo.init(this, CapuchooConfig(endpoint = BuildConfig.CAPUCHOO_ENDPOINT, channel = "prod"))
 * when (val check = Capuchoo.check()) {
 *     is UpdateCheck.Available -> Capuchoo.install(Capuchoo.download(check.release))
 *     else -> Unit
 * }
 * ```
 */
public object Capuchoo {
    @Volatile
    private var updater: Updater? = null

    /** Call once, from `Application.onCreate`. A second call is ignored. */
    @JvmStatic
    public fun init(context: Context, config: CapuchooConfig) {
        if (updater != null) return
        val problems = config.problems()
        require(problems.isEmpty()) { "Capuchoo is misconfigured: ${problems.joinToString("; ")}" }
        val created = synchronized(this) {
            updater ?: Updater(context, config).also { updater = it }
        }
        if (config.checkOnForeground) observeForeground(created)
    }

    /** Where this install is in an update. */
    public val state: StateFlow<UpdateState> get() = require().state

    /** The channel environment's remote configuration, from the last successful check. */
    public val remoteConfig: StateFlow<Map<String, Any?>> get() = require().remoteConfig

    /** Asks the server whether a newer build is assigned to this install's channel. */
    public suspend fun check(): UpdateCheck = require().check()

    /** Downloads and verifies an offered release; nothing unverified is ever returned. */
    public suspend fun download(release: NativeRelease): VerifiedApk = require().download(release)

    /** Hands a verified APK to Android. On success the app is replaced and restarted. */
    public suspend fun install(apk: VerifiedApk): Unit = require().install(apk)

    /** Whether the user allowed this app to install updates; ask with [installPermissionIntent]. */
    public fun canInstall(): Boolean = require().canInstall()

    /** Opens the settings screen where the user allows this app to install updates. */
    public fun installPermissionIntent(): Intent = require().permissionIntent()

    internal fun onInstallFailed(message: String) {
        updater?.onInstallFailed(message)
    }

    private fun require(): Updater =
        updater ?: error("Capuchoo.init(context, config) must be called before using Capuchoo")

    private fun observeForeground(updater: Updater) {
        val observer = object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) = updater.checkIfDue()
        }
        val lifecycle = ProcessLifecycleOwner.get().lifecycle
        if (Looper.myLooper() == Looper.getMainLooper()) lifecycle.addObserver(observer)
        else Handler(Looper.getMainLooper()).post { lifecycle.addObserver(observer) }
    }
}
