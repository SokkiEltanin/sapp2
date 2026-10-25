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
- Google Calendar API — włączone w projekcie `sapp2-a2354`.
- OAuth consent screen — skonfigurowany (external), scope
  `https://www.googleapis.com/auth/calendar.events` (dokładnie ten co w sapp,
  `app/settings.tsx` → `GoogleSignin.configure`).
- **Web Client ID** (do `webClientId` w `GoogleSignin.configure`):
  `237061417548-pent1blbeebj8kov67f8f5focr98usgr.apps.googleusercontent.com`
- **Android OAuth client — DO ZROBIENIA PÓŹNIEJ.** Wymaga SHA-1 z keystore'a, który
  jeszcze nie istnieje (powstanie przy pierwszym buildzie EAS). Wtedy: Google Cloud
  Console → Dane logowania → Utwórz dane logowania → Android → package
  `com.sokki.sapp2` + SHA-1 z `eas credentials`. Po tym trzeba będzie na nowo pobrać
  `google-services.json` (obecny ma pusty `oauth_client: []`).

## OCR paragonów
- ŚWIADOMIE pominięte — user zostaje przy parserze tekstu (share-intent SELECT ALL →
  SHARE), nie przy OCR zdjęcia. Zero potrzeby na Google Vision API / jego klucz.
