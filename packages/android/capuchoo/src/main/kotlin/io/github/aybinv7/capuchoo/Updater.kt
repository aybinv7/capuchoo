package io.github.aybinv7.capuchoo

import android.content.Context
import android.os.SystemClock
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** One app's update flow: the state a UI renders and the steps that move it. */
internal class Updater(context: Context, private val config: CapuchooConfig) {
    private val app = context.applicationContext
    private val http = JsonHttp(config.timeout)
    private val device = DeviceInfo(app)
    private val downloader = ApkDownloader(app, config.publicKey, config.timeout)
    private val installer = ApkInstaller(app)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val checking = Mutex()
    private var lastCheck = 0L

    private val _state = MutableStateFlow<UpdateState>(UpdateState.Idle)
    val state: StateFlow<UpdateState> = _state.asStateFlow()

    private val _remoteConfig = MutableStateFlow<Map<String, Any?>>(emptyMap())
    val remoteConfig: StateFlow<Map<String, Any?>> = _remoteConfig.asStateFlow()

    init {
        scope.launch(Dispatchers.IO) { downloader.discardInstalled() }
    }

    suspend fun check(): UpdateCheck = checking.withLock {
        _state.value = UpdateState.Checking
        lastCheck = SystemClock.elapsedRealtime()
        try {
            val facts = device.facts()
            val body = buildCheckRequest(facts, config, BuildConfig.LIBRARY_VERSION)
            val response = parseCheckResponse(http.post("${config.baseUrl}/api/update", body), facts.appId)
            _remoteConfig.value = response.config
            _state.value = when (val check = response.check) {
                is UpdateCheck.Available -> UpdateState.Available(check.release)
                is UpdateCheck.Blocked -> UpdateState.Blocked(check.message).also { Log.w(TAG, check.message) }
                UpdateCheck.UpToDate -> UpdateState.UpToDate
            }
            response.check
        } catch (error: CapuchooException) {
            _state.value = UpdateState.Failed(null, error)
            throw error
        }
    }

    /** Checks when the app returns to the foreground, at most once per [CapuchooConfig.minCheckInterval]. */
    fun checkIfDue() {
        val due = lastCheck == 0L ||
            SystemClock.elapsedRealtime() - lastCheck >= config.minCheckInterval.inWholeMilliseconds
        val busy = _state.value is UpdateState.Downloading || _state.value is UpdateState.Installing
        if (!due || busy || checking.isLocked) return
        lastCheck = SystemClock.elapsedRealtime()
        scope.launch {
            try {
                check()
            } catch (error: CapuchooException) {
                Log.w(TAG, "Update check failed: ${error.message}")
            }
        }
    }

    suspend fun download(release: NativeRelease): VerifiedApk {
        report("download", release)
        _state.value = UpdateState.Downloading(release, 0, release.fileSize)
        return try {
            downloader.download(release) { bytes, total ->
                _state.value = UpdateState.Downloading(release, bytes, total)
            }.also {
                report("download_complete", release)
                _state.value = UpdateState.ReadyToInstall(it)
            }
        } catch (error: CapuchooException) {
            fail(release, error)
        }
    }

    suspend fun install(apk: VerifiedApk) {
        report("install", apk.release)
        _state.value = UpdateState.Installing(apk.release)
        try {
            installer.install(apk)
        } catch (error: CapuchooException) {
            fail(apk.release, error)
        }
    }

    fun canInstall(): Boolean = installer.canInstall()

    fun permissionIntent() = installer.permissionIntent()

    fun onInstallFailed(message: String) {
        val release = (_state.value as? UpdateState.Installing)?.release
        val error = CapuchooException(CapuchooException.Reason.Install, message)
        _state.value = UpdateState.Failed(release, error)
        release?.let { report("error", it, message) }
    }

    private fun fail(release: NativeRelease, error: CapuchooException): Nothing {
        _state.value = UpdateState.Failed(release, error)
        report("error", release, error.message)
        throw error
    }

    /** Best effort: telemetry never delays or breaks an update. */
    private fun report(event: String, release: NativeRelease, error: String? = null) {
        scope.launch {
            try {
                val payload = buildEventPayload(event, device.facts(), config, release, error)
                http.post("${config.baseUrl}/api/native-updates/log", payload, attempts = 1)
            } catch (failure: Exception) {
                Log.d(TAG, "Could not record $event: ${failure.message}")
            }
        }
    }

    private companion object {
        const val TAG = "Capuchoo"
    }
}
