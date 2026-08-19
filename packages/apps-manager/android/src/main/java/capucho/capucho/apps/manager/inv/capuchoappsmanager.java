package capucho.capucho.apps.manager.inv;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import java.util.List;

public class capuchoappsmanager {

    public String echo(String value) {
        Logger.info("Echo", value);
        return value;
    }

    public JSObject getAppInfo(Context context, String bundleId) {
        PackageManager pm = context.getPackageManager();
        JSObject ret = new JSObject();
        ret.put("bundleId", bundleId);

        try {
            PackageInfo pInfo = pm.getPackageInfo(bundleId, 0);
            ret.put("isInstalled", true);
            ret.put("versionName", pInfo.versionName);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                ret.put("versionCode", pInfo.getLongVersionCode());
            } else {
                ret.put("versionCode", pInfo.versionCode);
            }
        } catch (PackageManager.NameNotFoundException e) {
            ret.put("isInstalled", false);
        }
        return ret;
    }

    public JSArray getInstalledApps(Context context) {
        PackageManager pm = context.getPackageManager();
        List<PackageInfo> packages = pm.getInstalledPackages(0);
        JSArray apps = new JSArray();

        for (PackageInfo pInfo : packages) {
            JSObject app = new JSObject();
            app.put("bundleId", pInfo.packageName);
            app.put("isInstalled", true);
            app.put("versionName", pInfo.versionName);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                app.put("versionCode", pInfo.getLongVersionCode());
            } else {
                app.put("versionCode", pInfo.versionCode);
            }
            apps.put(app);
        }
        return apps;
    }

    public boolean openApp(Context context, String bundleId) {
        PackageManager pm = context.getPackageManager();
        Intent launchIntent = pm.getLaunchIntentForPackage(bundleId);

        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(launchIntent);
            return true;
        }
        return false;
    }
}
