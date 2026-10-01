package io.github.aybinv7.capuchoo

/** An APK the server offers this install. */
public data class NativeRelease(
    val versionName: String,
    val versionCode: Long,
    val downloadUrl: String,
    /** The user may not postpone it. */
    val required: Boolean,
    val releaseNotes: String?,
    val fileSize: Long?,
    /** Lowercase hex SHA-256 of the APK. */
    val checksum: String?,
    /** base64url release signature, verified against [CapuchooConfig.publicKey]. */
    val signature: String?,
    /** The app's primary bundle identifier, the one the signature was made for. */
    val appId: String,
)

/** What the server answered to an update check. */
public sealed interface UpdateCheck {
    public data class Available(val release: NativeRelease) : UpdateCheck

    public data object UpToDate : UpdateCheck

    /**
     * The server refused to answer for this install: an unknown app or channel, a paused channel,
     * a flavour mismatch. A deployment mistake, never a reason to stay silent.
     */
    public data class Blocked(val message: String) : UpdateCheck
}

/** A downloaded APK whose checksum, signature and package identity were verified. */
public data class VerifiedApk(val file: java.io.File, val release: NativeRelease)
