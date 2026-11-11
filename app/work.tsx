import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Plus, ChevronDown, ChevronUp, CheckCircle2, EyeOff, Eye, BadgeCheck } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import Segmented from '@/components/design/Segmented';
import Toggle from '@/components/design/Toggle';
import NumberInput from '@/components/design/NumberInput';
import { useWorkStore } from '@/store/workStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useExpensesStore } from '@/store/expensesStore';
import { computeWorkRate } from '@/utils/workRate';
import { computePayMonths, payMonthsSummary } from '@/utils/workSummary';
import { haptic } from '@/utils/haptics';

// Ekran "Praca" (2026-11-09, user: "lecimy z zakładką Praca", potem "Pełny port z
// sapp od razu") — satelicki ekran Finansów (ten sam wzorzec co bank-review.tsx/
// bank-history.tsx: `SafeAreaView`+ręczny header z `ChevronLeft`, nie `src/ui/
// layout.tsx`'s kit zarezerwowany dla 4 głównych zakładek), wejście z Finanse's
// kafelka "Praca" (StatTile, `app/(tabs)/finances.tsx`). Pełny opis portu/adaptacji
// (dlaczego `Employer[]` bez mirrorowanego `WorkSettings`, co świadomie NIE
// portowane) w src/types/work.ts/src/utils/workRate.ts.
//
// Jeden ekran łączy to co w sapp było rozbite na Ustawienia→Praca + app/work/add.tsx
// + app/work/history.tsx (ten sam "jeden ujednolicony" wzorzec co AddExpenseModal
// scaliło scan.tsx+manual.tsx w sapp2) — lista pracodawców, edycja aktywnego,
// statystyki, historia wypłat z potwierdzaniem/wykluczaniem miesięcy, wszystko w
// jednym scrollu.

export default function WorkScreen() {
  const s = makeS();
  const employers = useWorkStore((st) => st.employers);
  const activeEmployerId = useWorkStore((st) => st.activeEmployerId);
  const addEmployer = useWorkStore((st) => st.addEmployer);
  const updateEmployer = useWorkStore((st) => st.updateEmployer);
  const toggleEmployerHidden = useWorkStore((st) => st.toggleEmployerHidden);
  const setActiveEmployer = useWorkStore((st) => st.setActiveEmployer);
  const events = useCalendarStore((st) => st.events);
  const gcalEvents = useCalendarStore((st) => st.gcalEvents);
  const expenses = useExpensesStore((st) => st.expenses);
  const allEvents = useMemo(() => [...events, ...gcalEvents], [events, gcalEvents]);

  const [viewingId, setViewingId] = useState<string | null>(activeEmployerId ?? employers[0]?.id ?? null);
  const [overridesOpen, setOverridesOpen] = useState(false);
  const viewing = employers.find((e) => e.id === viewingId) ?? null;

  const handleAddEmployer = () => {
    haptic.tap();
    const emp = addEmployer({ name: 'Nowy pracodawca', monthlySalary: 5000, hoursPerMonth: 168, workMode: 'calendar' });
    setViewingId(emp.id);
  };

  const rate = useMemo(() => (viewing ? computeWorkRate(viewing, allEvents, expenses) : null), [viewing, allEvents, expenses]);
  const payMonths = useMemo(() => (viewing ? computePayMonths(expenses, allEvents, viewing) : []), [viewing, expenses, allEvents]);
  const summary = useMemo(() => payMonthsSummary(payMonths), [payMonths]);

  const confirmMonth = (month: string, amount: number, hours: number) => {
    if (!viewing) return;
    haptic.success();
    updateEmployer(viewing.id, {
      confirmedMonths: { ...(viewing.confirmedMonths ?? {}), [month]: { salary: amount, hours } },
    });
  };
  const toggleExcludeMonth = (month: string) => {
    if (!viewing) return;
    haptic.tap();
    const cur = new Set(viewing.excludedPayMonths ?? []);
    if (cur.has(month)) cur.delete(month); else cur.add(month);
    updateEmployer(viewing.id, { excludedPayMonths: [...cur] });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Praca</Text>
        <TouchableOpacity onPress={handleAddEmployer} style={s.backBtn} hitSlop={8}>
          <Plus size={20} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {employers.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.empRow}>
          {employers.map((e) => (
            <TouchableOpacity
              key={e.id}
              style={[s.empChip, e.id === viewingId && s.empChipOn, e.hidden && s.empChipHidden]}
              onPress={() => { haptic.tap(); setViewingId(e.id); }}
              activeOpacity={0.8}
            >
              {e.id === activeEmployerId && <BadgeCheck size={12} color={e.id === viewingId ? colors.bg.primary : colors.accent.green} />}
              <Text style={[s.empChipLabel, e.id === viewingId && s.empChipLabelOn]} numberOfLines={1}>{e.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!viewing ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>Brak pracodawców. Dodaj pierwszego, żeby appka zaczęła liczyć godziny i stawkę.</Text>
          <TouchableOpacity style={s.addBtn} onPress={handleAddEmployer} activeOpacity={0.8}>
            <Plus size={16} color={colors.bg.primary} />
            <Text style={s.addBtnLabel}>Dodaj pracodawcę</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Nazwa + aktywny/ukryty */}
          <View style={s.card}>
            <TextInput
              value={viewing.name}
              onChangeText={(t) => updateEmployer(viewing.id, { name: t })}
              style={s.nameInput}
              placeholder="Nazwa pracodawcy"
              placeholderTextColor={colors.text.muted}
            />
            <View style={s.rowBetween}>
              <TouchableOpacity
                style={[s.pillBtn, viewing.id === activeEmployerId && s.pillBtnOn]}
                onPress={() => { haptic.success(); setActiveEmployer(viewing.id); }}
                activeOpacity={0.8}
                disabled={viewing.id === activeEmployerId}
              >
                <CheckCircle2 size={13} color={viewing.id === activeEmployerId ? colors.bg.primary : colors.text.secondary} />
                <Text style={[s.pillLabel, viewing.id === activeEmployerId && s.pillLabelOn]}>
                  {viewing.id === activeEmployerId ? 'Aktywny pracodawca' : 'Ustaw jako aktywny'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.iconBtn} onPress={() => toggleEmployerHidden(viewing.id)} activeOpacity={0.8}>
                {viewing.hidden ? <EyeOff size={16} color={colors.text.muted} /> : <Eye size={16} color={colors.text.secondary} />}
              </TouchableOpacity>
            </View>
            {viewing.hidden && <Text style={s.hiddenNote}>Ukryty z łącznych statystyk — dane zostają, można odkryć.</Text>}
          </View>

          {/* Tryb liczenia — 2026-11-09, user: "dodawanie pracodawców chujowe,
              wszystko ma być automatycznie jak w sapp... godziny z kalendarza,
              wypłata z finansów musi być po [prefiksie]" — WCZEŚNIEJ ten kard
              zawsze pokazywał WSZYSTKIE pola naraz (prefiks+kolor+pensja+godziny),
              wyglądające jak ręczna konfiguracja każdego z osobna, choć
              `computeWorkRate` i tak liczy wszystko samo z prefiksu. Teraz: tryb
              Kalendarz pokazuje TYLKO prefiks (jedyne co trzeba wpisać — reszta,
              godziny z kalendarza + wypłata z Finansów, dopasowuje się
              automatycznie przez ten prefiks, bez dalszej konfiguracji). Pensja/
              godziny/kolor przeniesione do "Nadpisania" jako wartości ZAPASOWE
              (używane TYLKO dopóki appka nie ma jeszcze żadnej realnej wypłaty/
              zmiany do policzenia) — tryb Ręczny jest wyjątkiem, tam SĄ jedynym
              wejściem, więc zostają tu widoczne. */}
          <View style={s.card}>
            <Text style={s.label}>Tryb liczenia</Text>
            <Segmented
              options={[{ key: 'calendar', label: 'Kalendarz' }, { key: 'manual', label: 'Ręczny' }]}
              activeKey={viewing.workMode ?? 'calendar'}
              onChange={(k) => updateEmployer(viewing.id, { workMode: k as 'calendar' | 'manual' })}
            />
            {(viewing.workMode ?? 'calendar') === 'calendar' ? (
              <>
                <Text style={[s.label, s.labelSpaced]}>Prefiks tytułu wydarzenia (np. "[JD]")</Text>
                <TextInput
                  value={viewing.workPrefix ?? ''}
                  onChangeText={(t) => updateEmployer(viewing.id, { workPrefix: t })}
                  style={s.input}
                  placeholder="[JD]"
                  placeholderTextColor={colors.text.muted}
                  autoCapitalize="none"
                />
                <Text style={s.hiddenNote}>
                  I tyle — oznacz zmiany w kalendarzu i wypłatę w Finansach (tag albo notatka) tym samym prefiksem, appka sama policzy godziny, stawkę i średnią. Reszta pól (pensja zapasowa, kolor, nadpisania) w "Nadpisania" niżej, opcjonalne.
                </Text>
              </>
            ) : (
              <>
                <Text style={[s.label, s.labelSpaced]}>Pensja miesięczna</Text>
                <NumberInput
                  value={viewing.monthlySalary}
                  onChangeValue={(n) => updateEmployer(viewing.id, { monthlySalary: n ?? 0 })}
                  style={s.input}
                  placeholder="np. 4500"
                  placeholderTextColor={colors.text.muted}
                />
                <Text style={[s.label, s.labelSpaced]}>Godziny miesięcznie</Text>
                <NumberInput
                  value={viewing.hoursPerMonth}
                  onChangeValue={(n) => updateEmployer(viewing.id, { hoursPerMonth: n ?? 0 })}
                  style={s.input}
                  placeholder="np. 160"
                  placeholderTextColor={colors.text.muted}
                />
              </>
            )}
          </View>

          {/* Nadpisania — zwinięte, ten sam wzorzec co AddExpenseModal's "Rozlicz jako" */}
          <View style={s.card}>
            <TouchableOpacity style={s.summaryRow} onPress={() => setOverridesOpen((v) => !v)} activeOpacity={0.7}>
              <Text style={s.label}>Nadpisania</Text>
              {overridesOpen ? <ChevronUp size={16} color={colors.text.muted} /> : <ChevronDown size={16} color={colors.text.muted} />}
            </TouchableOpacity>
            {overridesOpen && (
              <View style={s.overridesBody}>
                {(viewing.workMode ?? 'calendar') === 'calendar' && (
                  <>
                    <Text style={s.hiddenNote}>Poniższe liczą się TYLKO dopóki appka nie ma jeszcze żadnej realnej wypłaty/zmiany do policzenia z prefiksu — potem są ignorowane.</Text>
                    <Text style={[s.label, s.labelSpaced]}>Pensja miesięczna (zapasowa)</Text>
                    <NumberInput
                      value={viewing.monthlySalary}
                      onChangeValue={(n) => updateEmployer(viewing.id, { monthlySalary: n ?? 0 })}
                      style={s.input}
                      placeholder="np. 4500"
                      placeholderTextColor={colors.text.muted}
                    />
                    <Text style={[s.label, s.labelSpaced]}>Godziny miesięcznie (zapasowe)</Text>
                    <NumberInput
                      value={viewing.hoursPerMonth}
                      onChangeValue={(n) => updateEmployer(viewing.id, { hoursPerMonth: n ?? 0 })}
                      style={s.input}
                      placeholder="np. 160"
                      placeholderTextColor={colors.text.muted}
                    />
                    <Text style={[s.label, s.labelSpaced]}>Albo kolor wydarzenia (hex, zamiast/obok prefiksu)</Text>
                    <TextInput
                      value={viewing.workColor ?? ''}
                      onChangeText={(t) => updateEmployer(viewing.id, { workColor: t || undefined })}
                      style={s.input}
                      placeholder="#FF0000"
                      placeholderTextColor={colors.text.muted}
                      autoCapitalize="none"
                    />
                  </>
                )}
                <Text style={[s.label, s.labelSpaced]}>Stała stawka zł/h (nadpisuje wszystko)</Text>
                <NumberInput
                  value={viewing.rateOverride}
                  onChangeValue={(n) => updateEmployer(viewing.id, { rateOverride: n || undefined })}
                  style={s.input}
                  placeholder="np. 35"
                  placeholderTextColor={colors.text.muted}
                />
                <Text style={[s.label, s.labelSpaced]}>Nadpisanie godzin (ostatni miesiąc)</Text>
                <NumberInput
                  value={viewing.hoursOverride}
                  onChangeValue={(n) => updateEmployer(viewing.id, { hoursOverride: n || undefined })}
                  style={s.input}
                  placeholder="np. 160"
                  placeholderTextColor={colors.text.muted}
                />
                <Text style={[s.label, s.labelSpaced]}>Nadpisanie kwoty wypłaty</Text>
                <NumberInput
                  value={viewing.salaryOverride}
                  onChangeValue={(n) => updateEmployer(viewing.id, { salaryOverride: n || undefined })}
                  style={s.input}
                  placeholder="np. 4200"
                  placeholderTextColor={colors.text.muted}
                />
              </View>
            )}
          </View>

          {/* Statystyki */}
          <View style={s.card}>
            <Text style={s.label}>Statystyki</Text>
            <View style={s.statsRow}>
              <View style={s.statCol}>
                <Text style={s.statNum}>{rate?.rate != null ? rate.rate.toFixed(2) : '—'}</Text>
                <Text style={s.statUnit}>zł / h</Text>
              </View>
              <View style={s.statCol}>
                <Text style={s.statNum}>{rate ? rate.monthWorkHours.toFixed(1) : '—'}</Text>
                <Text style={s.statUnit}>h ten miesiąc</Text>
              </View>
              <View style={s.statCol}>
                <Text style={s.statNum}>{summary.totalEarned.toFixed(0)}</Text>
                <Text style={s.statUnit}>zł łącznie</Text>
              </View>
            </View>
          </View>

          {/* Historia wypłat */}
          <View style={s.card}>
            <Text style={s.label}>Historia wypłat</Text>
            {payMonths.length === 0 ? (
              <Text style={s.hiddenNote}>
                {(viewing.workMode ?? 'calendar') === 'manual'
                  ? 'Tryb ręczny — bez dopasowywania wypłat z kalendarza.'
                  : 'Jeszcze żadnej wypłaty z tagiem/notatką pasującą do prefiksu.'}
              </Text>
            ) : payMonths.map((row) => {
              const confirmed = viewing.confirmedMonths?.[row.month];
              return (
                <View key={row.month} style={s.payRow}>
                  <View style={s.payRowTop}>
                    <Text style={s.payMonth}>{row.month}</Text>
                    <Text style={s.payAmount}>{row.amount.toFixed(2)} zł</Text>
                  </View>
                  <Text style={s.payHours}>{row.hours.toFixed(1)} h kalendarza{row.count > 1 ? ` · ${row.count} wypłaty w tym miesiącu` : ''}</Text>
                  <View style={s.payActions}>
                    <TouchableOpacity style={s.payActBtn} onPress={() => confirmMonth(row.month, row.amount, row.hours)} activeOpacity={0.8}>
                      <Text style={[s.payActText, !!confirmed && s.payActTextOn]}>{confirmed ? 'Potwierdzone' : 'Potwierdź'}</Text>
                    </TouchableOpacity>
                    <View style={s.excludeRow}>
                      <Text style={s.payActText}>Wyklucz ze średniej</Text>
                      <Toggle value={row.excluded} onValueChange={() => toggleExcludeMonth(row.month)} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },

  empRow: { paddingHorizontal: spacing[3], gap: spacing[2], paddingBottom: spacing[2] },
  empChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated,
  },
  empChipOn: { backgroundColor: c.text.primary, borderColor: c.text.primary },
  empChipHidden: { opacity: 0.5 },
  empChipLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  empChipLabelOn: { color: c.bg.primary },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], paddingHorizontal: spacing[6] },
  emptyText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', lineHeight: 19 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.text.bright, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  addBtnLabel: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },

  scroll: { padding: spacing[4], paddingTop: spacing[2] },
  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], marginBottom: spacing[3] },

  nameInput: { fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.primary, paddingVertical: spacing[1], marginBottom: spacing[2] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  pillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: 8,
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated, flexShrink: 1,
  },
  pillBtnOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  pillLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  pillLabelOn: { color: c.bg.primary },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  hiddenNote: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[2], lineHeight: 16 },

  label: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelSpaced: { marginTop: spacing[3] },
  input: {
    marginTop: spacing[2], borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary,
  },

  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overridesBody: { marginTop: spacing[1] },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing[3] },
  statCol: { alignItems: 'center' },
  statNum: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.primary },
  statUnit: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted, marginTop: 2 },

  payRow: { borderTopWidth: 1, borderTopColor: c.border.default, paddingTop: spacing[2], marginTop: spacing[2] },
  payRowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  payMonth: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.text.primary },
  payAmount: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.accent.green },
  payHours: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },
  payActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[2] },
  payActBtn: { paddingVertical: 6, paddingHorizontal: spacing[2], borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  payActText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  payActTextOn: { color: c.accent.green },
  excludeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
}));
