import { useDeferredValue, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Search, X, Receipt, StickyNote, CheckSquare, Repeat, RefreshCw, Car } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { useExpensesStore } from '@/store/expensesStore';
import { useNotesStore } from '@/store/notesStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useSubscriptionsStore } from '@/store/subscriptionsStore';
import { useReplacementsStore } from '@/store/replacementsStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { globalSearch, type HitKind, type SearchHit } from '@/utils/globalSearch';
import { openNote } from '@/services/notesNav';
import { haptic } from '@/utils/haptics';

// Szukaj w całej appce (2026-11-14) — lupa w dolnym pasku. Logika: utils/globalSearch.ts.
const GROUPS: { kind: HitKind; label: string; Icon: typeof Receipt }[] = [
  { kind: 'expense', label: 'Transakcje', Icon: Receipt },
  { kind: 'note', label: 'Notatki', Icon: StickyNote },
  { kind: 'task', label: 'Zadania', Icon: CheckSquare },
  { kind: 'subscription', label: 'Stałe opłaty', Icon: Repeat },
  { kind: 'replacement', label: 'Wymiany', Icon: RefreshCw },
  { kind: 'vehicle', label: 'Pojazdy', Icon: Car },
];
const zl = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n).toFixed(2).replace('.', ',')} zł`;
const dateLabel = (d?: string) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(2, 4)}` : '');

function openHit(h: SearchHit) {
  haptic.tap();
  switch (h.kind) {
    case 'expense': router.navigate({ pathname: '/finances', params: { expense: h.id } } as any); break;
    case 'note': openNote(h.id); break;
    case 'task': router.navigate({ pathname: '/tasks', params: { task: h.id } } as any); break;
    case 'subscription': router.push('/subscriptions' as any); break;
    case 'replacement': router.push('/replacements' as any); break;
    case 'vehicle': router.push({ pathname: '/vehicles', params: { id: h.id } } as any); break;
  }
}

export default function SearchScreen() {
  const s = makeS();
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const expenses = useExpensesStore((st) => st.expenses);
  const notes = useNotesStore((st) => st.notes);
  const tasks = useCalendarStore((st) => st.tasks);
  const subscriptions = useSubscriptionsStore((st) => st.subscriptions);
  const replacements = useReplacementsStore((st) => st.items);
  const vehicles = useVehiclesStore((st) => st.vehicles);
  const res = useMemo(
    () => globalSearch({ expenses, notes, tasks, subscriptions, replacements, vehicles }, dq),
    [dq, expenses, notes, tasks, subscriptions, replacements, vehicles],
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headBtn} hitSlop={8}><ChevronLeft size={22} color={colors.text.primary} /></TouchableOpacity>
        <View style={s.field}>
          <Search size={16} color={colors.text.muted} />
          <TextInput value={q} onChangeText={setQ} autoFocus placeholder="Szukaj: sklep, produkt, notatka, kwota…" placeholderTextColor={colors.text.muted}
            style={s.input} autoCorrect={false} returnKeyType="search" />
          {q ? <TouchableOpacity onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Wyczyść"><X size={16} color={colors.text.muted} /></TouchableOpacity> : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
        {dq.trim().length < 2 ? (
          <Text style={s.empty}>Wpisz co najmniej 2 znaki. Szuka w transakcjach (też w pozycjach paragonów i po kwocie, np. „12,50”), notatkach, zadaniach, stałych opłatach, wymianach i pojazdach.</Text>
        ) : res.total === 0 ? (
          <Text style={s.empty}>Nic nie znaleziono dla „{dq.trim()}”.</Text>
        ) : GROUPS.filter((g) => res[g.kind].length).map(({ kind, label, Icon }) => (
          <View key={kind} style={s.group}>
            <View style={s.groupHead}>
              <Icon size={13} color={colors.text.muted} />
              <Text style={s.groupLabel}>{label} · {res[kind].length}{res[kind].length >= 30 ? '+' : ''}</Text>
            </View>
            {res[kind].map((h) => (
              <TouchableOpacity key={h.id} style={s.row} onPress={() => openHit(h)} activeOpacity={0.7}>
                <View style={s.main}>
                  <Text style={s.title} numberOfLines={1}>{h.title}</Text>
                  {(h.sub || h.date) ? <Text style={s.sub} numberOfLines={1}>{[dateLabel(h.date), h.sub].filter(Boolean).join(' · ')}</Text> : null}
                </View>
                {h.amount != null && <Text style={[s.amount, h.amount > 0 && { color: colors.accent.green }]}>{zl(h.amount)}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  headBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3] },
  input: { flex: 1, minWidth: 0, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary },
  list: { paddingHorizontal: spacing[4], paddingBottom: 60 },
  empty: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, lineHeight: 18, paddingVertical: spacing[4] },
  group: { marginTop: spacing[3] },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  groupLabel: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.ui.line },
  main: { flex: 1, minWidth: 0 },
  title: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  sub: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 1 },
  amount: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
}));
