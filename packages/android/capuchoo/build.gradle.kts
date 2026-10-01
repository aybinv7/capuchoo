plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    `maven-publish`
}

val libraryVersion = (findProperty("version") as String?)
    ?.takeUnless { it == "unspecified" }
    ?: "0.1.0-SNAPSHOT"

group = "com.github.aybinv7.capuchoo"
version = libraryVersion

android {
    namespace = "io.github.aybinv7.capuchoo"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
        consumerProguardFiles("consumer-rules.pro")
        buildConfigField("String", "LIBRARY_VERSION", "\"${libraryVersion.removePrefix("android-v")}\"")
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

kotlin {
    jvmToolchain(17)
    explicitApi()
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("androidx.lifecycle:lifecycle-process:2.8.4")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
}

publishing {
    publications {
        register<MavenPublication>("release") {
            groupId = "com.github.aybinv7.capuchoo"
            artifactId = "capuchoo-android"
            version = libraryVersion
            afterEvaluate { from(components["release"]) }
            pom {
                name.set("Capuchoo for Android")
                description.set("Self-hosted native updates for Android apps: check, download, verify, install.")
                url.set("https://github.com/aybinv7/capuchoo")
            }
        }
    }
}
