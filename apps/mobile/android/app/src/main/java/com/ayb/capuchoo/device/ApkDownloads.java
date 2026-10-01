package com.ayb.capuchoo.device;

import android.content.Context;
import android.content.pm.PackageInfo;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Streams an APK into the cache while hashing it, so the checksum is known the moment the last
 * byte lands - a WebView download would cross the bridge in base64 and hash in JavaScript. A file
 * whose digest differs from the server's is deleted before anything can open it.
 */
final class ApkDownloads {
    interface Progress {
        void report(String key, long bytes, long total);
    }

    private static final int BUFFER = 64 * 1024;
    private static final long PROGRESS_EVERY_MS = 120;
    private static final int TIMEOUT_MS = 30_000;

    private final Context context;
    private final Map<String, Boolean> cancelled = new ConcurrentHashMap<>();

    ApkDownloads(Context context) {
        this.context = context;
    }

    File directory() {
        File dir = new File(context.getCacheDir(), "capuchoo-downloads");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Could not create " + dir);
        return dir;
    }

    void cancel(String key) {
        cancelled.put(key, true);
    }

    void clear() {
        File[] files = directory().listFiles();
        if (files != null) for (File file : files) file.delete();
    }

    JSObject download(String key, String url, String expectedSha256, Progress progress) throws Exception {
        cancelled.remove(key);
        String safe = key.replaceAll("[^A-Za-z0-9_-]", "_");
        File partial = new File(directory(), safe + ".apk.part");
        File target = new File(directory(), safe + ".apk");

        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(TIMEOUT_MS);
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long received = 0;
        try {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IOException("The download answered " + status);
            long total = connection.getContentLengthLong();
            long lastReport = 0;
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial)) {
                byte[] buffer = new byte[BUFFER];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    if (Boolean.TRUE.equals(cancelled.get(key))) throw new IOException("cancelled");
                    output.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    received += read;
                    long now = System.currentTimeMillis();
                    if (now - lastReport >= PROGRESS_EVERY_MS) {
                        lastReport = now;
                        progress.report(key, received, total);
                    }
                }
                output.getFD().sync();
            }
            progress.report(key, received, total > 0 ? total : received);
        } catch (Exception error) {
            partial.delete();
            throw error;
        } finally {
            connection.disconnect();
            cancelled.remove(key);
        }

        String sha256 = Signatures.hex(digest.digest());
        if (expectedSha256 != null && !expectedSha256.isEmpty() && !expectedSha256.equalsIgnoreCase(sha256)) {
            partial.delete();
            throw new SecurityException("The downloaded file does not match the checksum the server recorded, so it was deleted.");
        }
        if (target.exists()) target.delete();
        if (!partial.renameTo(target)) throw new IOException("Could not move the download into place");

        PackageInfo archive = PackageQueries.archive(context.getPackageManager(), target);
        if (archive == null) {
            target.delete();
            throw new IOException("The download is not an APK this phone can read, so it was deleted.");
        }

        JSObject result = new JSObject();
        result.put("path", target.getAbsolutePath());
        result.put("bytes", received);
        result.put("sha256", sha256);
        result.put("packageName", archive.packageName);
        result.put("versionName", archive.versionName);
        result.put("versionCode", PackageQueries.versionCode(archive));
        String certificate = Signatures.certificateSha256(archive);
        if (certificate != null) result.put("signingCertSha256", certificate);
        return result;
    }
}
