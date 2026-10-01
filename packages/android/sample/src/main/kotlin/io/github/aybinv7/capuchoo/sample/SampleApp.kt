package io.github.aybinv7.capuchoo.sample

import android.app.Application
import io.github.aybinv7.capuchoo.Capuchoo
import io.github.aybinv7.capuchoo.CapuchooConfig

class SampleApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Capuchoo.init(
            this,
            CapuchooConfig(
                endpoint = BuildConfig.CAPUCHOO_ENDPOINT,
                channel = BuildConfig.CAPUCHOO_CHANNEL.ifEmpty { null },
                publicKey = BuildConfig.CAPUCHOO_PUBLIC_KEY.ifEmpty { null },
                environment = BuildConfig.CAPUCHOO_CHANNEL.takeIf { it in setOf("dev", "staging", "prod") },
            ),
        )
    }
}
