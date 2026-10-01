import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val server = Properties().apply {
    file("capuchoo.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}

fun quoted(key: String): String = "\"${server.getProperty(key, "")}\""

android {
    namespace = "io.github.aybinv7.capuchoo.sample"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.aybinv7.capuchoo.sample"
        minSdk = 26
        targetSdk = 35
        versionCode = (findProperty("capuchoo.versionCode") as String?)?.toInt() ?: 1
        versionName = findProperty("capuchoo.versionName") as String? ?: "1.0.0"
        buildConfigField("String", "CAPUCHOO_ENDPOINT", quoted("endpoint"))
        buildConfigField("String", "CAPUCHOO_PUBLIC_KEY", quoted("publicKey"))
    }

    signingConfigs {
        System.getenv("CAPUCHOO_KEYSTORE_FILE")?.let { keystore ->
            create("release") {
                storeFile = file(keystore)
                storePassword = System.getenv("CAPUCHOO_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("CAPUCHOO_KEY_ALIAS")
                keyPassword = System.getenv("CAPUCHOO_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.findByName("release")
        }
    }

    flavorDimensions += "environment"
    productFlavors {
        create("dev") {
            dimension = "environment"
            buildConfigField("String", "CAPUCHOO_CHANNEL", "\"dev\"")
        }
        create("prod") {
            dimension = "environment"
            buildConfigField("String", "CAPUCHOO_CHANNEL", "\"prod\"")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(project(":capuchoo"))
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
}
