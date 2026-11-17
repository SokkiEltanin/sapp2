import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { AlarmClock } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { setShowOverLockScreen, wakeScreen } from '@/services/lockScreen';
import { testMeta, cancelTestNotifications } from '@/services/notifyTests';

// Ekran alarmu pełnoekranowego (2026-10-29; od 2026-11-17 dla testów z app/notify-test.tsx).
// Otwiera go `fullScreenAction` powiadomienia (hooks/useNotifeeAlertLaunch.ts, `?test=`).
// - `setShowOverLockScreen` TYLKO na czas tego ekranu (src/services/lockScreen.ts) — reszta
//   appki NIGDY nie pokazuje się nad blokadą (finanse!).
// - `wakeScreen` (2026-11-17, user: "nie działa wybudzenie") — wake lock z
//   ACQUIRE_CAUSES_WAKEUP; samo setTurnScreenOn z JS przychodzi za późno.
// - Dźwięk w pętli gra powiadomienie (loopSound) — "Wyłącz" je kasuje.
const VIBRATION_PATTERN = [0, 600, 400];

export default function AlertTestScreen() {
  const s = makeS();
  const { test } = useLocalSearchParams<{ test?: string }>();
  const meta = testMeta(test ?? '') ?? { label: 'Alarm', desc: '', color: colors.accent.red };

  useEffect(() => {
    setShowOverLockScreen(true);
    wakeScreen(60000);
    Vibration.vibrate(VIBRATION_PATTERN, true);
    return () => {
      Vibration.cancel();
      setShowOverLockScreen(false);
    };
  }, []);

  const dismiss = () => {
    Vibration.cancel();
    cancelTestNotifications();
    setShowOverLockScreen(false);
    if (router.canGoBack()) router.back(); else router.replace('/');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={[s.center, { backgroundColor: meta.color + '22' }]}>
        <View style={[s.iconWrap, { backgroundColor: meta.color + '33', borderColor: meta.color }]}>
          <AlarmClock size={52} color={meta.color} />
        </View>
        <Text style={s.kicker}>TEST POWIADOMIEŃ</Text>
        <Text style={[s.title, { color: meta.color }]}>{meta.label}</Text>
        <Text style={s.subtitle}>Jeśli widzisz ten ekran nad blokadą (albo wybudził zgaszony telefon) — działa.</Text>
        <TouchableOpacity style={[s.button, { backgroundColor: meta.color }]} onPress={dismiss} activeOpacity={0.8}>
          <Text style={s.buttonLabel}>Wyłącz</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], paddingHorizontal: spacing[6] },
  iconWrap: { width: 112, height: 112, borderRadius: radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[2] },
  kicker: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, letterSpacing: 1.2 },
  title: { fontSize: 26, fontFamily: 'Inter_900Black', textAlign: 'center' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.secondary, textAlign: 'center', lineHeight: 19, marginBottom: spacing[3] },
  button: { borderRadius: radius.lg, paddingHorizontal: spacing[8], paddingVertical: spacing[4] },
  buttonLabel: { fontSize: 17, fontFamily: 'Inter_900Black', color: '#000000' },
}));
