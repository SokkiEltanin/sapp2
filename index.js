// Własny punkt wejścia (2026-11-14): przed ekranami rejestruje obsługę akcji
// powiadomień w tle (notifee przy zamkniętej appce uruchamia sam JS) — patrz
// src/services/notifeeBackground.ts. Reszta jak domyślnie: expo-router/entry.
import { Platform } from 'react-native';
import { registerNotifeeBackground } from './src/services/notifeeBackground';

if (Platform.OS === 'android') registerNotifeeBackground();

import 'expo-router/entry';
