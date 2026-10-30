import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { setShowOverLockScreen } from '@/services/lockScreen';

// Dedykowany ekran alarmu notifee (2026-10-29) — user po teście na urządzeniu:
// pełnoekranowy full-screen-intent DZIAŁA (otwiera appkę NAD blokadą ekranu, gdy
// appka była w tle — pierwsze potwierdzone działanie tego mechanizmu w sapp2), ale
// (a) brak dźwięku/wibracji, (b) ląduje w zwykłym, ostatnio otwartym ekranie appki
// (np. Ustawienia), nie w dedykowanym "ekranie alarmu". User: "trzeba dostosować
// okno alertu osobne... żeby nie cała apka była tylko alarm screen testowy z
// wibracjami lub dźwiękiem". Ten ekran + deep-link w src/hooks/useNotifeeAlertLaunch.ts
// rozwiązują (b) i częściowo (a).
//
// Wibracja — wbudowane RN `Vibration` (zero nowej zależności/assetu), pętla aż do
// dismissu. Dźwięk — ŚWIADOMIE pominięty na razie: wymaga pliku audio do
// zbundlowania, którego nie ma w assets/ (user: "dostosowywanie później w
// ustawieniach czy coś" — zaakceptowane jako kolejny krok, nie blokuje tego).
//
// `setShowOverLockScreen` (2026-10-30, user: "cała aplikacja się buguje... nie
// chcę żeby ktoś na zablokowanym telefonie mógł [finanse] przeglądać") — JEDYNE
// miejsce w appce gdzie włączamy "pokaż nad blokadą" — TYLKO na czas montowania
// TEGO ekranu, wyłączane natychmiast na unmount. Patrz src/services/lockScreen.ts
// i plugins/withFullScreenAlert.js — wcześniejsza wersja robiła to na stałe na
// całej MainActivity, co omijało blokadę ekranu dla CAŁEJ appki, nie tylko alarmu.
const VIBRATION_PATTERN = [0, 600, 400];

export default function AlertTestScreen() {
  const s = makeS();

  useEffect(() => {
    setShowOverLockScreen(true);
    Vibration.vibrate(VIBRATION_PATTERN, true);
    return () => {
      Vibration.cancel();
      setShowOverLockScreen(false);
    };
  }, []);

  const dismiss = () => {
    Vibration.cancel();
    setShowOverLockScreen(false);
    router.replace('/');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <View style={s.iconWrap}>
          <AlertTriangle size={48} color={colors.accent.red} />
        </View>
        <Text style={s.title}>Alarm testowy</Text>
        <Text style={s.subtitle}>
          Pełnoekranowy alert notifee, wyzwolony nad zablokowanym ekranem. Dźwięk
          dojdzie w kolejnej rundzie (potrzebny plik audio do zbundlowania).
        </Text>
        <TouchableOpacity style={s.button} onPress={dismiss} activeOpacity={0.8}>
          <Text style={s.buttonLabel}>Wyłącz</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], paddingHorizontal: spacing[6] },
  iconWrap: {
    width: 96, height: 96, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${colors.accent.red}1A`, marginBottom: spacing[2],
  },
  title: { fontSize: 24, fontFamily: 'Inter_900Black', color: c.text.primary },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: c.text.muted, textAlign: 'center', lineHeight: 19, marginBottom: spacing[3] },
  button: {
    backgroundColor: colors.accent.red, borderRadius: radius.lg,
    paddingHorizontal: spacing[7], paddingVertical: spacing[3],
  },
  buttonLabel: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
}));
