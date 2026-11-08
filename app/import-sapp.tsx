import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, ClipboardPaste, CheckCircle2, AlertTriangle } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { importSappPayload, type ImportResult } from '@/services/dataImportFromSapp';
import { haptic } from '@/utils/haptics';

// Ekran "Importuj dane z sapp" (2026-11-09, user: "musimy dodac zeby eksport
// zrobic z sapp danych do sapp2 - głównie zależy mi na finansach i paragonach
// wstecz oraz humor") — sapp i sapp2 to OSOBNE projekty Firebase, więc appka nie
// może po prostu sama sięgnąć po dane sapp. sapp JUŻ ma gotowy eksport (Ustawienia
// → Dane → "Kopia zapasowa" → eksportuje cały JSON, Share Sheet) — ten ekran to
// druga połówka: wklej treść tego pliku (otwórz go gdziekolwiek wylądował —
// mail/Drive/Pliki, zaznacz całość, kopiuj), appka sparsuje i wstawi WYŁĄCZNIE
// wydatki/paragony i humor (patrz src/services/dataImportFromSapp.ts po pełny
// opis mapowania — reszta bloku, kalendarz/zadania/praca/pojazdy, świadomie
// pomijana, sapp2 ma te podsystemy własne). Bezpieczne odpalić wielokrotnie —
// dedup po id, ponowny import tego samego pliku nic nie zdubluje.
export default function ImportSappScreen() {
  const s = makeS();
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pasteFromClipboard = async () => {
    const t = await Clipboard.getStringAsync();
    if (t) { haptic.tap(); setText(t); }
  };

  const runImport = () => {
    setError(null);
    setResult(null);
    if (!text.trim()) return;
    try {
      const r = importSappPayload(text);
      haptic.success();
      setResult(r);
    } catch {
      haptic.error();
      setError('Nie udało się odczytać tego jako eksport sapp — sprawdź, czy wklejona treść to CAŁY plik JSON (nie jego fragment).');
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Importuj z sapp</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.hint}>
            1. W sapp: Ustawienia → Dane → "Kopia zapasowa" → eksportuj.{'\n'}
            2. Otwórz wyeksportowany plik (mail/Drive/Pliki), zaznacz całą treść, skopiuj.{'\n'}
            3. Wklej tu poniżej i zatwierdź.
          </Text>
          <Text style={s.hint}>Zaimportują się TYLKO wydatki/paragony i humor — reszta (kalendarz, zadania…) jest pomijana, sapp2 ma to własne.</Text>
        </View>

        <View style={s.card}>
          <View style={s.pasteRow}>
            <Text style={s.label}>Wklejony eksport</Text>
            <TouchableOpacity onPress={pasteFromClipboard} style={s.pasteBtn} activeOpacity={0.8}>
              <ClipboardPaste size={13} color={colors.text.secondary} />
              <Text style={s.pasteBtnLabel}>Wklej ze schowka</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            value={text}
            onChangeText={setText}
            style={s.textarea}
            multiline
            placeholder="Wklej tu całą treść pliku sapp-export-....json"
            placeholderTextColor={colors.text.muted}
          />
          <TouchableOpacity style={[s.importBtn, !text.trim() && s.importBtnDisabled]} onPress={runImport} disabled={!text.trim()} activeOpacity={0.8}>
            <Text style={s.importBtnLabel}>Importuj</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={[s.card, s.errorCard]}>
            <AlertTriangle size={16} color={colors.accent.red} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {result && (
          <View style={[s.card, s.resultCard]}>
            <CheckCircle2 size={18} color={colors.accent.green} />
            <View style={{ flex: 1 }}>
              <Text style={s.resultTitle}>Zaimportowano</Text>
              <Text style={s.resultLine}>Wydatki/paragony: {result.expensesAdded} nowych{result.expensesSkipped > 0 ? ` (${result.expensesSkipped} już było)` : ''}</Text>
              <Text style={s.resultLine}>Humor: {result.moodAdded} nowych{result.moodSkipped > 0 ? ` (${result.moodSkipped} już było)` : ''}</Text>
            </View>
          </View>
        )}
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
  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], marginBottom: spacing[3] },

  hint: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.secondary, lineHeight: 18, marginBottom: spacing[2] },

  pasteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  pasteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pasteBtnLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  textarea: {
    marginTop: spacing[2], minHeight: 140, borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md,
    padding: spacing[3], fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.primary, textAlignVertical: 'top',
  },
  importBtn: { marginTop: spacing[3], backgroundColor: c.text.bright, borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  importBtnDisabled: { opacity: 0.4 },
  importBtnLabel: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },

  errorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  errorText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium', color: c.accent.red, lineHeight: 17 },

  resultCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  resultTitle: { fontSize: 13.5, fontFamily: 'Inter_900Black', color: c.text.primary, marginBottom: 4 },
  resultLine: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.secondary, marginTop: 2 },
}));
