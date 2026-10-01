package io.github.aybinv7.capuchoo.sample

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import io.github.aybinv7.capuchoo.Capuchoo
import io.github.aybinv7.capuchoo.CapuchooException
import io.github.aybinv7.capuchoo.UpdateState
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/** Every state of the update flow, on one screen, with the two actions a user takes. */
class MainActivity : Activity() {
    private val scope = MainScope()
    private lateinit var status: TextView
    private lateinit var update: Button
    private lateinit var allow: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val padding = (24 * resources.displayMetrics.density).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(padding, padding * 3, padding, padding)
        }
        root.addView(TextView(this).apply {
            text = getString(R.string.title)
            textSize = 26f
            contentDescription = "title"
        })
        root.addView(TextView(this).apply {
            text = getString(R.string.version, BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE)
            textSize = 18f
            tag = "version"
            contentDescription = "version"
        })
        status = TextView(this).apply {
            textSize = 16f
            setPadding(0, padding, 0, padding)
            contentDescription = "status"
        }
        root.addView(status)
        root.addView(Button(this).apply {
            text = getString(R.string.check)
            contentDescription = "check"
            setOnClickListener { check() }
        })
        update = Button(this).apply {
            text = getString(R.string.update)
            contentDescription = "update"
            isEnabled = false
            setOnClickListener { update() }
        }
        root.addView(update)
        allow = Button(this).apply {
            text = getString(R.string.allow)
            contentDescription = "allow"
            setOnClickListener { startActivity(Capuchoo.installPermissionIntent()) }
        }
        root.addView(allow)
        setContentView(root)

        scope.launch { Capuchoo.state.collect(::render) }
    }

    override fun onResume() {
        super.onResume()
        allow.visibility = if (Capuchoo.canInstall()) Button.GONE else Button.VISIBLE
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun check() = scope.launch {
        try {
            Capuchoo.check()
        } catch (_: CapuchooException) {
        }
    }

    private fun update() = scope.launch {
        val state = Capuchoo.state.value as? UpdateState.Available ?: return@launch
        try {
            Capuchoo.install(Capuchoo.download(state.release))
        } catch (_: CapuchooException) {
        }
    }

    private fun render(state: UpdateState) {
        update.isEnabled = state is UpdateState.Available
        status.text = when (state) {
            UpdateState.Idle -> "Idle"
            UpdateState.Checking -> "Checking..."
            UpdateState.UpToDate -> "Up to date"
            is UpdateState.Available ->
                "Available: ${state.release.versionName} (build ${state.release.versionCode})" +
                    if (state.release.required) ", required" else ""
            is UpdateState.Downloading ->
                "Downloading ${state.release.versionName}: ${state.progress?.let { "${(it * 100).toInt()}%" } ?: "${state.bytes} bytes"}"
            is UpdateState.ReadyToInstall -> "Verified ${state.apk.release.versionName}"
            is UpdateState.Installing -> "Installing ${state.release.versionName}..."
            is UpdateState.Blocked -> "Blocked: ${state.message}"
            is UpdateState.Failed -> "Failed (${state.error.reason}): ${state.error.message}"
        }
    }
}
