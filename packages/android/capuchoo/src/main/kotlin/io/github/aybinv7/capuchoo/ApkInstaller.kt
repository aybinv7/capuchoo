package io.github.aybinv7.capuchoo

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Hands a verified APK to the system through a [PackageInstaller] session. Android asks the user
 * to confirm unless this app may update itself silently; the answer arrives in
 * [InstallResultReceiver].
 */
internal class ApkInstaller(private val context: Context) {

    /** Whether the user allowed this app to install apps; required before [install]. */
    fun canInstall(): Boolean = context.packageManager.canRequestPackageInstalls()

    /** The settings screen where the user grants it. */
    fun permissionIntent(): Intent =
        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    suspend fun install(apk: VerifiedApk) = withContext(Dispatchers.IO) {
        if (!canInstall())
            throw CapuchooException(
                CapuchooException.Reason.Permission,
                "Allow this app to install updates in Android settings, then try again",
            )

        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(context.packageName)
            setSize(apk.file.length())
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        }

        val sessionId = installer.createSession(params)
        try {
            installer.openSession(sessionId).use { session ->
                session.openWrite("base.apk", 0, apk.file.length()).use { output ->
                    apk.file.inputStream().use { it.copyTo(output) }
                    session.fsync(output)
                }
                session.commit(resultSender(sessionId))
            }
        } catch (error: Exception) {
            installer.abandonSession(sessionId)
            throw CapuchooException(
                CapuchooException.Reason.Install,
                "Could not hand the update to Android: ${error.message}",
                error,
            )
        }
    }

    private fun resultSender(sessionId: Int) = PendingIntent.getBroadcast(
        context,
        sessionId,
        Intent(context, InstallResultReceiver::class.java).setPackage(context.packageName),
        PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0,
    ).intentSender
}
