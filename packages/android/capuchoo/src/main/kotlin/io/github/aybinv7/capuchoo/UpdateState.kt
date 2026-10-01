package io.github.aybinv7.capuchoo

/** Where this install is in an update, for a UI to render. */
public sealed interface UpdateState {
    public data object Idle : UpdateState

    public data object Checking : UpdateState

    public data object UpToDate : UpdateState

    public data class Available(val release: NativeRelease) : UpdateState

    public data class Downloading(
        val release: NativeRelease,
        val bytes: Long,
        val totalBytes: Long?,
    ) : UpdateState {
        /** 0 to 1, or null while the size is unknown. */
        val progress: Float? get() = totalBytes?.takeIf { it > 0 }?.let { bytes.toFloat() / it }
    }

    public data class ReadyToInstall(val apk: VerifiedApk) : UpdateState

    /** Handed to the system installer; the app is replaced and restarted when it succeeds. */
    public data class Installing(val release: NativeRelease) : UpdateState

    public data class Blocked(val message: String) : UpdateState

    public data class Failed(val release: NativeRelease?, val error: CapuchooException) : UpdateState
}

/** Why an update step failed, with a message a user or developer can act on. */
public class CapuchooException(
    public val reason: Reason,
    message: String,
    cause: Throwable? = null,
) : Exception(message, cause) {
    public enum class Reason {
        Configuration,
        Network,
        Server,
        Integrity,
        Permission,
        Install,
    }
}
