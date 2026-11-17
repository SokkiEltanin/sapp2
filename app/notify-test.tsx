import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Check, AlertCircle, Bell } from 'lucide-react-native';
import { goBack } from '@/services/nav';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { haptic } from '@/utils/haptics';
import { NOTIFY_TESTS, runNotifyTest, notifyStatus, fixStatus, type NotifyStatus, type NotifyTestKey } from '@/services/notifyTests';

// Testy powiadomień (2026-11-17) — logika w services/notifyTests.ts. Każdy test w swoim
// kolorze, JEDNO powiadomienie na stuknięcie. Na górze zgody systemowe, bez których
// pełny ekran / wybudzenie nie zadziała (każda z przyciskiem naprawy).
const DELAYS: { ms: number; l: string }[] = [{ ms: 0, l: 'Teraz' }, { ms: 10000, l: '10 s' }, { ms: 60000, l: '1 min' }, { ms: 300000, l: '5 min' }];
const STATUS_ROWS: { k: keyof NotifyStatus; l: string; ok: (v: boolean) => boolean; hint: string }[] = [
  { k: 'permission', l: 'Zgoda na powiadomienia', ok: (v) => v, hint: 'bez niej nic nie przyjdzie' },
  { k: 'fullScreen', l: 'Pełnoekranowe powiadomienia', ok: (v) => v, hint: 'Android 14+: bez tego alarm to tylko baner' },
  { k: 'exactAlarm', l: 'Alarmy i przypomnienia', ok: (v) => v, hint: 'dokładna godzina przy zgaszonym ekranie' },
  { k: 'batteryOptimized', l: 'Bez optymalizacji baterii', ok: (v) => !v, hint: 'inaczej system może opóźnić alarm' },
];

export default function NotifyTestScreen() {
  const s = makeS();
  const [delay, setDelay] = useState(10000);
  const [status, setStatus] = useState<NotifyStatus | null>(null);
  const [log, setLog] = useState<{ k: NotifyTestKey | 'info'; text: string }[]>([]);
  const refresh = useCallback(() => { notifyStatus().then(setStatus).catch(() => {}); }, []);

  useEffect(() => {
    refresh();
    // wraca z ustawień systemowych → odśwież zgody
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  const run = async (k: NotifyTestKey) => {
    haptic.tap();
    try {
      const msg = await runNotifyTest(k, delay);
      setLog((l) => [{ k, text: `${NOTIFY_TESTS.find((t) => t.k === k)!.label}: ${msg}${delay > 0 && k !== 'basic' && k !== 'basicActions' ? ' Zablokuj ekran teraz.' : ''}` }, ...l].slice(0, 8));
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setLog((l) => [{ k, text: /Native module|TurboModule|cannot be null/.test(msg) ? 'Powiadomienia działają tylko w zainstalowanym APK.' : `Błąd: ${msg}` }, ...l].slice(0, 8));
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={goBack} style={s.back} hitSlop={8}><ChevronLeft size={22} color={colors.text.primary} /></TouchableOpacity>
        <Text style={s.title}>Testy powiadomień</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.label}>Zgody systemowe</Text>
        <View style={s.card}>
          {STATUS_ROWS.map((r) => {
            const v = status?.[r.k];
            const good = v == null ? null : r.ok(v);
            return (
              <View key={r.k} style={s.stRow}>
                {good == null ? <Bell size={16} color={colors.text.muted} /> : good ? <Check size={16} color={colors.accent.green} /> : <AlertCircle size={16} color={colors.accent.red} />}
                <View style={{ flex: 1 }}>
                  <Text style={s.stLabel}>{r.l}</Text>
                  <Text style={s.stHint}>{good == null ? 'nie da się sprawdzić (stara wersja APK albo komputer)' : r.hint}</Text>
                </View>
                {good === false && (
                  <TouchableOpacity style={s.fix} onPress={() => { haptic.tap(); fixStatus(r.k).catch(() => {}); }}>
                    <Text style={s.fixTxt}>Napraw</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        <Text style={s.label}>Kiedy wysłać</Text>
        <View style={s.delays}>
          {DELAYS.map((d) => (
            <TouchableOpacity key={d.ms} style={[s.delay, delay === d.ms && s.delayOn]} onPress={() => { haptic.tap(); setDelay(d.ms); }}>
              <Text style={[s.delayTxt, delay === d.ms && s.delayTxtOn]}>{d.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.note}>Pełny ekran przy odblokowanym, włączonym telefonie Android pokazuje jako baner — to normalne. Wybudzenie testuj z opóźnieniem 1–5 min: zablokuj telefon i odłóż.</Text>

        <Text style={s.label}>Testy</Text>
        {NOTIFY_TESTS.map((t) => (
          <TouchableOpacity key={t.k} style={[s.test, { borderColor: t.color, backgroundColor: t.color + '1A' }]} onPress={() => run(t.k)} activeOpacity={0.8} accessibilityLabel={`Test: ${t.label}`}>
            <View style={[s.dot, { backgroundColor: t.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.testLabel, { color: t.color }]}>{t.label}</Text>
              <Text style={s.testDesc}>{t.desc}</Text>
            </View>
            <Text style={[s.go, { color: t.color }]}>Wyślij</Text>
          </TouchableOpacity>
        ))}

        {log.length > 0 && (
          <>
            <Text style={s.label}>Ostatnie</Text>
            {log.map((l, i) => (
              <Text key={i} style={[s.log, { color: NOTIFY_TESTS.find((t) => t.k === l.k)?.color ?? colors.text.secondary }]}>{l.text}</Text>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontFamily: 'Inter_900Black', color: c.text.primary },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[8] },
  label: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[4], marginBottom: spacing[2] },
  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, padding: spacing[3], gap: spacing[3] },
  stRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  stLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  stHint: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 1 },
  fix: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.md, backgroundColor: c.accent.red },
  fixTxt: { fontSize: 12, fontFamily: 'Inter_900Black', color: '#fff' },
  delays: { flexDirection: 'row', gap: 6 },
  delay: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  delayOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  delayTxt: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  delayTxtOn: { color: c.bg.primary },
  note: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[2] },
  test: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4], borderRadius: radius.lg, borderWidth: 1.5, marginBottom: spacing[2] },
  dot: { width: 12, height: 12, borderRadius: 6 },
  testLabel: { fontSize: 15, fontFamily: 'Inter_900Black' },
  testDesc: { fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter_500Medium', color: c.text.secondary, marginTop: 2 },
  go: { fontSize: 13, fontFamily: 'Inter_900Black' },
  log: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
}));
