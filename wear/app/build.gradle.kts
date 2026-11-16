plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sokki.sapp2.wear"
    compileSdk = 35

    defaultConfig {
        // TEN SAM applicationId i klucz podpisu co aplikacja na telefonie — inaczej
        // Wear Data Layer nie połączy zegarka z telefonem.
        applicationId = "com.sokki.sapp2"
        minSdk = 30 // Wear OS 3 (Galaxy Watch 4 i nowsze)
        targetSdk = 34
        versionCode = (System.getenv("WEAR_VERSION_CODE") ?: "1").toInt()
        versionName = "0.1.0"
    }

    signingConfigs {
        create("release") {
            val ks = System.getenv("WEAR_KEYSTORE")
            if (ks != null) {
                storeFile = file(ks)
                storePassword = System.getenv("WEAR_KEYSTORE_PASSWORD")
                keyAlias = "sapp2"
                keyPassword = System.getenv("WEAR_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (System.getenv("WEAR_KEYSTORE") != null) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("com.google.android.gms:play-services-wearable:18.2.0")
    // Kafelek (Tile) — przesunięcie tarczy: wydatki dziś, zadania.
    implementation("androidx.wear.tiles:tiles:1.4.1")
    implementation("androidx.wear.protolayout:protolayout:1.2.1")
    implementation("com.google.guava:guava:33.3.1-android")
    // Bateria zegarka co 15 min → telefon (BatteryReporter.kt).
    implementation("androidx.work:work-runtime-ktx:2.9.1")
}
