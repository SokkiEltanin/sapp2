import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ChevronLeft, Copy, Play } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { healthDiagnostics, type HealthDiagReport } from '@/services/healthConnectService';
import { haptic } from '@/utils/haptics';

// Test Health Connect (2026-11-13, user: "test wszystkiego, co łapię z zegarka...
// do skopiowania, żebyśmy mieli jakąś bazę"). Wejście: Ustawienia → Połączenia.
// Pokazuje KAŻDY typ danych: czy jest zgoda, ile rekordów z 7 dni, z jakich
// aplikacji (Samsung Health, zegarek, Google Fit…), kiedy ostatni. "Kopiuj"
// = pełny raport JSON z przykładowymi rekordami — do wklejenia w rozmowie.
const APP_NAMES: Record<string, string> = {
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.google.android.apps.healthdata': 'Health Connect',
  'com.samsung.android.wear.shealth': 'Galaxy Watch',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.garmin.android.apps.connectmobile': 'Garmin',
  'com.xiaomi.wearable': 'Mi Fitness',
  'com.huawei.health': 'Huawei Health',
};
const appName = (pkg: string) => APP_NAMES[pkg] ?? pkg;
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export default function HealthDebug() {
  const s = makeS();
  const [report, setReport] = useState<HealthDiagReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    haptic.tap();
    setBusy(true); setCopied(false);
    try { setReport(await healthDiagnostics(7)); } finally { setBusy(false); }
  };
  const copy = async () => {
    if (!report) return;
    await Clipboard.setStringAsync(JSON.stringify(report, null, 2));
    haptic.success();
    setCopied(true);
  };

  const withData = report?.types.filter((t) => t.count > 0) ?? [];
  const empty = report?.types.filter((t) => t.granted && t.count === 0) ?? [];
  const denied = report?.types.filter((t) => !t.granted) ?? [];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Test Health Connect</Text>
        <TouchableOpacity onPress={copy} style={s.backBtn} hitSlop={8} disabled={!report}>
          <Copy size={18} color={report ? colors.text.primary : colors.text.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.intro}>Sprawdza wszystkie typy danych z ostatnich 7 dni: co jest, z jakiej aplikacji i kiedy ostatnio. Przy pierwszym uruchomieniu Health Connect zapyta o zgody — zaznacz wszystkie.</Text>
        <TouchableOpacity style={[s.runBtn, busy && { opacity: 0.6 }]} onPress={run} disabled={busy} activeOpacity={0.8}>
          {busy ? <ActivityIndicator color={colors.bg.primary} /> : <Play size={15} color={colors.bg.primary} />}
          <Text style={s.runLabel}>{busy ? 'Czytam…' : report ? 'Uruchom ponownie' : 'Uruchom test'}</Text>
        </TouchableOpacity>

        {report && (
          <>
            <Text style={s.meta}>Health Connect: {report.sdk} · {withData.length} typów z danymi · {empty.length} pustych · {denied.length} bez zgody</Text>
            {copied && <Text style={s.copied}>Skopiowano pełny raport (JSON) do schowka.</Text>}

            {withData.length > 0 && <Text style={s.section}>Są dane</Text>}
            {withData.map((t) => (
              <View key={t.type} style={s.row}>
                <View style={s.rowTop}>
                  <Text style={s.type}>{t.type}</Text>
                  <Text style={s.count}>{t.count}</Text>
                </View>
                <Text style={s.sub} numberOfLines={2}>{Object.entries(t.origins).map(([o, n]) => `${appName(o)} (${n})`).join(' · ')}</Text>
                {t.last && <Text style={s.sub}>ostatni: {when(t.last)}</Text>}
                {t.error && <Text style={s.err}>{t.error}</Text>}
              </View>
            ))}

            {empty.length > 0 && <Text style={s.section}>Zgoda jest, brak danych</Text>}
            {empty.length > 0 && <Text style={s.list}>{empty.map((t) => t.type).join(', ')}</Text>}

            {denied.length > 0 && <Text style={s.section}>Bez zgody</Text>}
            {denied.length > 0 && <Text style={s.list}>{denied.map((t) => t.type).join(', ')}</Text>}

            <TouchableOpacity style={s.copyBtn} onPress={copy} activeOpacity={0.8}>
              <Copy size={14} color={colors.text.primary} />
              <Text style={s.copyLabel}>Kopiuj pełny raport</Text>
            </TouchableOpacity>
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  scroll: { padding: spacing[4], paddingTop: spacing[2] },
  intro: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, lineHeight: 17 },
  runBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.text.bright, borderRadius: radius.md, paddingVertical: spacing[3], marginTop: spacing[3] },
  runLabel: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },
  meta: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary, marginTop: spacing[3] },
  copied: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.accent.green, marginTop: spacing[1] },
  section: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[4], marginBottom: spacing[1] },
  row: { paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: c.border.default },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  type: { fontSize: 13.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  count: { fontSize: 13.5, fontFamily: 'Inter_900Black', color: c.accent.green },
  sub: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },
  err: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.accent.red, marginTop: 2 },
  list: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.text.secondary, lineHeight: 18 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingVertical: spacing[3], marginTop: spacing[4] },
  copyLabel: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
}));
