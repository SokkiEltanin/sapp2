# CLAUDE.md — sapp2

Zasady ustalane na bieżąco w trakcie budowy od zera. Dopisuj tu, gdy coś nowego
zostanie przesądzone — to jedyne miejsce, które się o tym pamięta między sesjami.

## Zasady, których nie łamać

1. **Tylko ciemny motyw, na zawsze.** Nie ma trybu jasnego, nie projektujemy pod
   dwa motywy. Jeśli coś wygląda jak przełącznik jasny/ciemny — to pomyłka.
2. **Nawigacja w zasięgu kciuka.** Najważniejsze akcje/ekrany muszą być wygodne do
   kliknięcia jedną ręką, bez przerzucania telefonu — thumb zone, nie górny róg.
3. **Jeden spójny system stylu, bez ad-hoc wariantów.** Jak tylko ustalimy wygląd
   (user pokazuje wzorce/referencje) — trzymamy się go wszędzie. Nowy ekran/komponent
   nie wymyśla sobie nowych kolorów/radiusów/cieni, tylko korzysta z tego co już jest
   w `src/theme`. (Będzie to też formalny design system do rozpisania, jak wzorce
   wejdą — na razie zasada brzmi: nie duplikuj, nie improwizuj.)
4. **Styl tylko przez `themedStyles((c) => StyleSheet.create(...))`** — ten sam
   powód co w `sapp`: per-komponentowy `StyleSheet.create` w renderze = realne ryzyko
   zwiechy/ANR, już raz złapane w `sapp`.
5. **Brak OCR paragonów.** Tylko parser tekstu (share-intent z Lidl+: Select All →
   Share), tak jak w `sapp`. Nie dodawać skanowania zdjęć/Vision API.
6. **`sapp` zostaje nietknięte.** To osobny, działający projekt-referencja — sapp2
   nie modyfikuje, nie usuwa, nie zależy od niczego w `sapp`.
7. **Firestore: `experimentalForceLongPolling` jest wymagane** (patrz `src/firebase.ts`)
   — bez tego zapisy/odczyty na realnym urządzeniu potrafią zawiesić się w
   nieskończoność bez błędu. Nie usuwać tej opcji "dla czystości".
8. **Build APK = GitHub Actions, bez EAS** (`expo prebuild` + goły Gradle, patrz
   `.github/workflows/build.yml` i `INFRA.md`). EAS zarezerwowane tylko pod przyszłe
   OTA, nieużywane jeszcze.

## Stack (skrót)

Expo SDK 54 · RN 0.81 New Arch · expo-router v6 · Zustand · Firebase (Firestore) ·
TypeScript · UI po polsku, tylko ciemny motyw · `com.sokki.sapp2` · APK z GitHub Actions.
