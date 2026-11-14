// Aplikacja Sapp2 na zegarek Wear OS (2026-11-14) — osobny, mały projekt Gradle (bez
// React Native): pokazuje dane, które wysyła telefon (plugins/withWearSync.js).
// Build: .github/workflows/wear.yml → GitHub Releases "wear-N" (prerelease).
pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "sapp2-wear"
include(":app")
