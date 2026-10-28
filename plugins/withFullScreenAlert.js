const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

// Pełnoekranowe alerty (2026-10-28, sandbox-test kilku podejść do prawdziwych
// full-screen-intent powiadomień jak budzik/połączenie przychodzące — user:
// "potraktujmy sapp2 jako pole do manewrów"). `notifee` samo wystawia natywne
// `fullScreenIntent` na powiadomieniu, ale Android pokaże docelową Activity NAD
// blokadą ekranu TYLKO jeśli ONA SAMA deklaruje `android:showWhenLocked="true"` +
// `android:turnScreenOn="true"` w manifeście — notifee tego za nas nie dokłada.
// Test używa `launchActivity: 'default'` (czyli MainActivity), więc te flagi lądują
// na niej. Ten sam wzorzec edycji manifestu co `withTasksWidget.js` w sapp.
//
// UWAGA (do oceny po teście, nie ukrywać): `showWhenLocked` na MainActivity jest
// GLOBALNE dla tej Activity, nie tylko w momencie alertu — jeśli się sprawdzi i
// zostaje na stałe, docelowo lepiej przenieść te flagi na DEDYKOWANĄ, osobną
// natywną Activity tylko dla alertów (nie na główną appkę), żeby zwykłe otwarcie
// appki z zablokowanego telefonu (np. z poziomu powiadomienia) nie omijało blokady
// ekranu poza kontekstem prawdziwego alertu.
function withFullScreenAlert(config) {
  return withAndroidManifest(config, (cfg) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    mainActivity.$['android:showWhenLocked'] = 'true';
    mainActivity.$['android:turnScreenOn'] = 'true';
    return cfg;
  });
}

module.exports = withFullScreenAlert;
