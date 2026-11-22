// Własny punkt wejścia (2026-11-14): przed ekranami rejestruje obsługę akcji
// powiadomień w tle (notifee przy zamkniętej appce uruchamia sam JS) — patrz
// src/services/notifeeBackground.ts. Reszta jak domyślnie: expo-router/entry.
import { Platform } from 'react-native';
import { registerNotifeeBackground } from './src/services/notifeeBackground';
import { defineBackgroundTask } from './src/services/backgroundRefresh';

if (Platform.OS === 'android') registerNotifeeBackground();
// Odświeżanie w tle (2026-11-22) — zadanie musi być zdefiniowane przy ładowaniu paczki.
if (Platform.OS === 'android') defineBackgroundTask();

import 'expo-router/entry';
