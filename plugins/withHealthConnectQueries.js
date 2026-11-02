// `react-native-health-connect`'s OWN bundled Expo plugin (node_modules/
// react-native-health-connect/app.plugin.js, zarejestrowany jako
// "react-native-health-connect" w app.json) już dodaje: intent-filter
// rationale (Android ≤13) i `ViewPermissionUsageActivity`-alias (Android 14+).
// Sprawdzone bezpośrednio w zainstalowanej wersji (^4.1.3) — port sapp's
// `withHealthConnectQueries.js` (biblioteka tam była v3) NIE powtarza tych
// dwóch rzeczy tutaj, żeby nie zdublować wpisów w manifeście.
//
// Dwie rzeczy, których OFICJALNY plugin dalej nie robi (sprawdzone w kodzie
// Kotlin biblioteki, `HealthConnectPermissionDelegate.kt`):
//
// 1) `<queries>` widoczność pakietu dla dostawcy Health Connect na Androidzie
//    11+ (bez tego `getSdkStatus()` może zwrócić UNAVAILABLE mimo że appka
//    faktycznie jest zainstalowana).
//
// 2) Inicjalizacja launchera uprawnień. `HealthConnectPermissionDelegate` ma
//    `lateinit var requestPermission`, ustawiane WYŁĄCZNIE przez
//    `setPermissionDelegate(activity)` — czego NIC w bibliotece samo nie
//    woła. Bez tego `requestPermission()` rzuca
//    `UninitializedPropertyAccessException` (crash). Wstrzykujemy wołanie do
//    `MainActivity.onCreate` (musi się wykonać PRZED stanem RESUMED, więc
//    zaraz po `super.onCreate(...)`).
const { withAndroidManifest, withMainActivity } = require('@expo/config-plugins');

const HC_PACKAGE = 'com.google.android.apps.healthdata';
const DELEGATE_IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const DELEGATE_CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

function withQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    if (!Array.isArray(manifest.queries)) manifest.queries = [];
    if (manifest.queries.length === 0) manifest.queries.push({});
    const q = manifest.queries[0];
    if (!Array.isArray(q.package)) q.package = [];
    if (!q.package.some((p) => p && p.$ && p.$['android:name'] === HC_PACKAGE)) {
      q.package.push({ $: { 'android:name': HC_PACKAGE } });
    }
    return cfg;
  });
}

function withPermissionDelegate(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') return cfg; // oczekuje Kotlinowej MainActivity
    let src = cfg.modResults.contents;
    if (!src.includes(DELEGATE_IMPORT)) {
      src = src.replace(/(^package .*$)/m, `$1\n\n${DELEGATE_IMPORT}`);
    }
    if (!src.includes(DELEGATE_CALL)) {
      src = src.replace(/(super\.onCreate\([^)]*\)\s*)/, `$1\n    ${DELEGATE_CALL}\n`);
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = function withHealthConnectFix(config) {
  return withPermissionDelegate(withQueries(config));
};
