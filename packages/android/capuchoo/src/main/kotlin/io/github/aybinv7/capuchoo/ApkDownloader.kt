package io.github.aybinv7.capuchoo

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import kotlin.coroutines.coroutineContext
import kotlin.time.Duration

/**
 * Downloads an offered APK into the app's cache and refuses it unless it is exactly what the
 * server described, signed by the configured key, and an upgrade of this very app.
 */
internal class ApkDownloader(
    private val context: Context,
    private val publicKey: String?,
    private val timeout: Duration,
) {
    private val directory get() = File(context.cacheDir, "capuchoo").apply { mkdirs() }

    suspend fun download(release: NativeRelease, onProgress: (Long, Long?) -> Unit): VerifiedApk =
        withContext(Dispatchers.IO) {
            val checksum = release.checksum
                ?: throw integrity("The server sent no checksum for ${release.versionName}, so it cannot be verified")
            val target = File(directory, "${release.versionCode}.apk")
            if (!target.exists() || sha256(target) != checksum) fetch(release, target, onProgress)
            verify(release, target)
            discardOthers(target)
            VerifiedApk(target, release)
        }

    private suspend fun fetch(release: NativeRelease, target: File, onProgress: (Long, Long?) -> Unit) {
        val partial = File(directory, "${release.versionCode}.apk.part")
        val connection = (URL(release.downloadUrl).openConnection() as HttpURLConnection).apply {
            connectTimeout = timeout.inWholeMilliseconds.toInt()
            readTimeout = timeout.inWholeMilliseconds.toInt()
        }
        try {
            val status = connection.responseCode
            if (status !in 200..299)
                throw CapuchooException(CapuchooException.Reason.Server, "The download answered $status")
            val total = connection.contentLengthLong.takeIf { it > 0 } ?: release.fileSize
            var received = 0L
            connection.inputStream.use { input ->
                partial.outputStream().use { output ->
                    val buffer = ByteArray(BUFFER_BYTES)
                    while (true) {
                        coroutineContext.ensureActive()
                        val read = input.read(buffer)
                        if (read < 0) break
                        output.write(buffer, 0, read)
                        received += read
                        onProgress(received, total)
                    }
                }
            }
            if (!partial.renameTo(target)) throw IOException("Could not move the download into place")
        } catch (error: IOException) {
            partial.delete()
            throw CapuchooException(CapuchooException.Reason.Network, "The download stopped: ${error.message}", error)
        } finally {
            connection.disconnect()
        }
    }

    private fun verify(release: NativeRelease, file: File) {
        val digest = sha256(file)
        if (digest != release.checksum) {
            file.delete()
            throw integrity("The downloaded APK does not match its checksum, so it was discarded")
        }
        if (publicKey != null && !ReleaseSignature.verify(release, digest, publicKey)) {
            file.delete()
            throw integrity("${release.versionName} is not signed by this app's release key, so it was discarded")
        }

        val archive = archiveInfo(file)
        if (archive == null) {
            file.delete()
            throw integrity("The download is not an APK this device can read")
        }
        if (archive.packageName != context.packageName) {
            file.delete()
            throw integrity("The APK is for ${archive.packageName}, not ${context.packageName}")
        }
        val installed = DeviceInfo.installedPackage(context).longVersionCodeCompat
        if (archive.longVersionCodeCompat <= installed) {
            file.delete()
            throw integrity("The APK is build ${archive.longVersionCodeCompat}, not above the installed $installed")
        }
    }

    private fun archiveInfo(file: File) =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            context.packageManager.getPackageArchiveInfo(file.path, PackageManager.PackageInfoFlags.of(0))
        else
            @Suppress("DEPRECATION")
            context.packageManager.getPackageArchiveInfo(file.path, 0)

    private fun discardOthers(keep: File) {
        directory.listFiles()?.filter { it != keep }?.forEach { it.delete() }
    }

    private fun integrity(message: String) = CapuchooException(CapuchooException.Reason.Integrity, message)

    private companion object {
        const val BUFFER_BYTES = 64 * 1024
    }
}

internal fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
        val buffer = ByteArray(64 * 1024)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            digest.update(buffer, 0, read)
        }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
}
