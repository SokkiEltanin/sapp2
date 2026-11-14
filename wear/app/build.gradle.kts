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
}
