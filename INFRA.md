# sapp2 — infrastruktura (notatki, nie kod)

Zbierane w trakcie ustawiania Firebase/Google — żeby nie trzeba było drugi raz szukać
w konsolach, jak będziemy scaffoldować właściwy projekt Expo.

## Firebase
- Projekt: `sapp2-a2354` (Google Cloud project = ten sam co Firebase)
- Package name (Android): `com.sokki.sapp2`
- `google-services.json` — już w repo (bezpieczne, publiczna konfiguracja klienta,
  tak samo jak w sapp).
- Web app config (do `EXPO_PUBLIC_FIREBASE_*` env, jak dojdziemy do eas.json):
  - authDomain: `sapp2-a2354.firebaseapp.com`
  - projectId: `sapp2-a2354`
  - storageBucket: `sapp2-a2354.firebasestorage.app`
  - messagingSenderId: `237061417548`
  - appId: `1:237061417548:web:e804071aad44628b0162e9`
  - measurementId: `G-LL3PBNWLM0`
  - **apiKey — CELOWO NIE TU.** W sapp ten jeden fragment configu żyje WYŁĄCZNIE jako
    GitHub Secret (`EXPO_PUBLIC_FIREBASE_API_KEY`), nie w repo — ta sama konwencja
    zostaje. Wartość ma user, poda przy spinaniu CI.

## Logowanie Google / Kalendarz
- **Firebase Authentication — WŁĄCZYĆ RĘCZNIE w konsoli** (2026-10-28, user złapał
  na urządzeniu: `auth/configuration-not-found` przy "Zaloguj przez Google"). To
  OSOBNY krok od OAuth/Calendar API niżej — Authentication jako produkt trzeba
  aktywować: console.firebase.google.com/project/sapp2-a2354/authentication →
  "Get started" → Sign-in method → Add provider → Google → włącz (support e-mail)
  → Save. Backendowa zmiana, NIE wymaga nowego builda APK.
- Google Calendar API — włączone w projekcie `sapp2-a2354`.
- OAuth consent screen — skonfigurowany (external), scope
  `https://www.googleapis.com/auth/calendar.events` (dokładnie ten co w sapp,
  `app/settings.tsx` → `GoogleSignin.configure`).
- **Web Client ID** (do `webClientId` w `GoogleSignin.configure`):
  `237061417548-pent1blbeebj8kov67f8f5focr98usgr.apps.googleusercontent.com`
- **Android OAuth client — ZROBIONE.** Package `com.sokki.sapp2`, SHA-1:
  `2D:37:5F:E5:40:A8:67:A3:E3:46:77:96:15:12:F2:C2:62:C9:D0:51`, client_id
  `237061417548-912ehc89de7em0riql1aduihpka70k42.apps.googleusercontent.com`.
  Świeży `google-services.json` (z oboma oauth_client — Android + Web) już w repo.

## OCR paragonów
- ŚWIADOMIE pominięte — user zostaje przy parserze tekstu (share-intent SELECT ALL →
  SHARE), nie przy OCR zdjęcia. Zero potrzeby na Google Vision API / jego klucz.

## EAS (OTA — na później)
- Projekt EAS stworzony (`eas init`) na nowym koncie Expo usera.
- **EAS project id:** `b56c7c9e-2c4a-4bef-8eb2-a76d49710dd6`
- Nieużywane jeszcze — build APK (niżej) nie wymaga EAS. To tylko przygotowanie
  pod `eas update` (OTA), jak w sapp's `ci.yml`, kiedy przyjdzie czas.

## Build APK — GitHub Actions (`.github/workflows/build.yml`)

Ten sam wzorzec co w sapp — ALE bez EAS (sprawdzone w sapp's build.yml: cały build to
`expo prebuild` + goły Gradle w CI, EAS tam służy TYLKO do OTA, które odłożyliśmy).
Zero potrzeby zakładania projektu EAS żeby mieć działający APK z GitHuba.

- Keystore (`sapp2-release.keystore`, alias `sapp2`) wygenerowany lokalnie,
  WYSŁANY userowi do bezpiecznego przechowania (SendUserFile) — plik i hasło NIE są
  nigdzie w repo/historii, tylko jako GitHub Secret.
- SHA-1: `2D:37:5F:E5:40:A8:67:A3:E3:46:77:96:15:12:F2:C2:62:C9:D0:51`
- SHA256: `46:69:BC:36:3B:E2:6E:EC:4C:BD:BB:7F:CE:96:A8:62:0D:79:16:88:C6:D9:77:E6:E8:57:03:47:D2:E7:B5:A3`
- **Wymagane GitHub Secrets** (Settings → Secrets and variables → Actions):
  `KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `EXPO_PUBLIC_FIREBASE_API_KEY`
  (wartość: ta sama co w `.env` lokalnie — patrz wyżej, user ją ma).
