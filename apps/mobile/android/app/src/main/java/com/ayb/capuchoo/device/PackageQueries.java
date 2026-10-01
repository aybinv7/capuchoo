package com.ayb.capuchoo.device;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import java.io.File;

/**
 * What the package manager knows about an app: whether it is installed, at which build, signed by
 * which certificate. Reading another app's package needs QUERY_ALL_PACKAGES on Android 11+, which
 * this internal tool declares: the apps it manages are a server-side list, not a manifest one.
 */
final class PackageQueries {
    private PackageQueries() {}

    @SuppressWarnings("deprecation")
    private static int signingFlag() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? PackageManager.GET_SIGNING_CERTIFICATES
            : PackageManager.GET_SIGNATURES;
    }

    @SuppressWarnings("deprecation")
    static long versionCode(PackageInfo info) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }

    @SuppressWarnings("deprecation")
    static PackageInfo installed(PackageManager pm, String packageName) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                return pm.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(signingFlag()));
            }
            return pm.getPackageInfo(packageName, signingFlag());
        } catch (PackageManager.NameNotFoundException missing) {
            return null;
        }
    }

    @SuppressWarnings("deprecation")
    static PackageInfo archive(PackageManager pm, File apk) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return pm.getPackageArchiveInfo(apk.getPath(), PackageManager.PackageInfoFlags.of(signingFlag()));
        }
        return pm.getPackageArchiveInfo(apk.getPath(), signingFlag());
    }

    static JSObject describe(PackageManager pm, String packageName) {
        JSObject state = new JSObject();
        state.put("packageName", packageName);
        PackageInfo info = installed(pm, packageName);
        state.put("installed", info != null);
        if (info != null) {
            state.put("versionName", info.versionName);
            state.put("versionCode", versionCode(info));
            state.put("lastUpdateTime", info.lastUpdateTime);
            String certificate = Signatures.certificateSha256(info);
            if (certificate != null) state.put("signingCertSha256", certificate);
        }
        return state;
    }

    static boolean open(Context context, String packageName) {
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(packageName);
        if (launch == null) return false;
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(launch);
        return true;
    }
}
