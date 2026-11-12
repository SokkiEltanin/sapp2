import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Plus, ChevronDown, ChevronUp, CheckCircle2, EyeOff, Eye, BadgeCheck, Pencil, Check } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import Segmented from '@/components/design/Segmented';
import NumberInput from '@/components/design/NumberInput';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useWorkStore } from '@/store/workStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useExpensesStore } from '@/store/expensesStore';
import { computePayMonths, payMonthsSummary } from '@/utils/workSummary';
import { workMonthProgress, upcomingShifts } from '@/utils/workMonth';
import { haptic } from '@/utils/haptics';

// Ekran "Praca" (2026-11-09 port z sapp; przebudowa 2026-11-12 wg CLAUDE.md
// zasady 10 "ekran = dane, nie konfiguracja"). Na górze: najbliższa wypłata,
// godziny X/Y w tym miesiącu, stawka, zarobione w roku, najbliższe zmiany,
// historia wypłat (kompaktowo: miesiąc · godziny · zł/h · kwota, potwierdź/
// wyklucz ikonami). Nazwa/aktywny/ukryty/tryb/prefiks/pensja/nadpisania →
// sheet "Edytuj" (ołówek). Logika stawki bez zmian (utils/workRate.ts).

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const WD = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;
const pl = (n: number, d = 0) => n.toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d });
const hrs = (h: number) => { const r = Math.round(h * 2) / 2; return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ','); };
const shiftDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${WD[new Date(y, m - 1, d).getDay()]} ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}`; };

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
  const [editOpen, setEditOpen] = useState(false);
  const [overridesOpen, setOverridesOpen] = useState(false);
  const viewing = employers.find((e) => e.id === viewingId) ?? null;
  const isCalendar = (viewing?.workMode ?? 'calendar') === 'calendar';

  const handleAddEmployer = () => {
    haptic.tap();
    const emp = addEmployer({ name: 'Nowy pracodawca', monthlySalary: 5000, hoursPerMonth: 168, workMode: 'calendar' });
    setViewingId(emp.id);
    setEditOpen(true);
  };

  const progress = useMemo(() => (viewing ? workMonthProgress(viewing, allEvents, expenses) : null), [viewing, allEvents, expenses]);
  const shifts = useMemo(() => (viewing && isCalendar ? upcomingShifts(viewing, allEvents, new Date(), 3) : []), [viewing, allEvents, isCalendar]);
  const payMonths = useMemo(() => (viewing ? computePayMonths(expenses, allEvents, viewing) : []), [viewing, expenses, allEvents]);
  const summary = useMemo(() => payMonthsSummary(payMonths), [payMonths]);
  const yearEarned = useMemo(() => {
    const y = String(new Date().getFullYear());
    return payMonths.filter((r) => r.date.startsWith(y)).reduce((sum, r) => sum + r.amount, 0);
  }, [payMonths]);

  const confirmMonth = (month: string, amount: number, hours: number) => {
    if (!viewing) return;
    haptic.success();
    const cur = { ...(viewing.confirmedMonths ?? {}) };
    if (cur[month]) delete cur[month]; else cur[month] = { salary: amount, hours };
    updateEmployer(viewing.id, { confirmedMonths: cur });
  };
  const toggleExcludeMonth = (month: string) => {
    if (!viewing) return;
    haptic.tap();
    const cur = new Set(viewing.excludedPayMonths ?? []);
    if (cur.has(month)) cur.delete(month); else cur.add(month);
    updateEmployer(viewing.id, { excludedPayMonths: [...cur] });
  };

  const rate = progress?.rate ?? null;
  const pct = progress?.hoursPlanned ? Math.min(100, ((progress.hoursDone ?? 0) / progress.hoursPlanned) * 100) : 0;

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.empRow} style={{ flexGrow: 0 }}>
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
          <Text style={s.emptyText}>Brak pracodawców. Dodaj pierwszego, żeby appka liczyła godziny, stawkę i wypłaty.</Text>
          <TouchableOpacity style={s.addBtn} onPress={handleAddEmployer} activeOpacity={0.8}>
            <Plus size={16} color={colors.bg.primary} />
            <Text style={s.addBtnLabel}>Dodaj pracodawcę</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Karta główna */}
          <View style={s.card}>
            <View style={s.heroHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.heroName} numberOfLines={1}>{viewing.name}</Text>
                <Text style={s.heroSub} numberOfLines={1}>
                  {viewing.id === activeEmployerId ? 'aktywny' : 'nieaktywny'}
                  {isCalendar ? ` · z kalendarza${viewing.workPrefix ? ` ${viewing.workPrefix}` : ''}` : ' · ręcznie'}
                  {viewing.hidden ? ' · ukryty' : ''}
                </Text>
              </View>
              <TouchableOpacity style={s.iconBtn} onPress={() => { haptic.tap(); setEditOpen(true); }} hitSlop={6} accessibilityLabel="Edytuj pracodawcę">
                <Pencil size={15} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={s.payBig}>
              {progress?.nextPay ? `≈${pl(Math.round(progress.nextPay.amount))}` : '—'}<Text style={s.payCur}> zł</Text>
            </Text>
            <Text style={s.paySub}>{progress?.nextPay ? `najbliższa wypłata · za ${monthName(progress.nextPay.month)}` : 'brak stawki — ustaw prefiks albo pensję w Edytuj'}</Text>

            {progress?.hoursPlanned != null && (
              <View style={s.hoursBlock}>
                <View style={s.track}><View style={[s.fill, { width: `${pct}%` }]} /></View>
                <Text style={s.hoursText}>{hrs(progress.hoursDone ?? 0)} / {hrs(progress.hoursPlanned)} h w tym miesiącu</Text>
              </View>
            )}

            <View style={s.grid}>
              <View style={s.gridCell}>
                <Text style={s.gridNum}>{rate != null ? pl(rate, 2) : '—'}</Text>
                <Text style={s.gridUnit}>zł / h</Text>
                {summary.avgRate != null && <Text style={s.gridSub}>śr. z wypłat {pl(summary.avgRate, 2)}</Text>}
              </View>
              <View style={s.gridCell}>
                <Text style={s.gridNum}>{pl(yearEarned)}</Text>
                <Text style={s.gridUnit}>zł w {new Date().getFullYear()}</Text>
                {summary.includedCount > 0 && <Text style={s.gridSub}>śr. {pl(summary.totalEarned / summary.includedCount)} zł / wypłatę</Text>}
              </View>
            </View>
          </View>

          {/* Najbliższe zmiany */}
          {shifts.length > 0 && (
            <View style={s.card}>
              <Text style={s.label}>Najbliższe zmiany</Text>
              {shifts.map((sh) => (
                <View key={sh.id} style={s.row}>
                  <Text style={s.rowMain}>{shiftDay(sh.date)}</Text>
                  <Text style={s.rowMid}>{sh.startTime && sh.endTime ? `${sh.startTime}–${sh.endTime}` : ''} · {hrs(sh.hours)} h</Text>
                  {rate != null && <Text style={s.rowRight}>≈{pl(Math.round(sh.hours * rate))} zł</Text>}
                </View>
              ))}
            </View>
          )}

          {/* Historia wypłat */}
          <View style={s.card}>
            <Text style={s.label}>Wypłaty</Text>
            {payMonths.length === 0 ? (
              <Text style={s.note}>
                {isCalendar ? `Brak przychodu z prefiksem ${viewing.workPrefix || '(ustaw w Edytuj)'}.` : 'Tryb ręczny — wypłaty nie są dopasowywane.'}
              </Text>
            ) : payMonths.map((row) => {
              const confirmed = !!viewing.confirmedMonths?.[row.month];
              const monthRate = row.hours > 0 ? row.amount / row.hours : null;
              return (
                <View key={row.month} style={[s.row, row.excluded && { opacity: 0.45 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowMain}>{monthName(row.month)} {row.month.slice(0, 4)}</Text>
                    <Text style={s.rowSub}>{hrs(row.hours)} h{monthRate != null ? ` · ${pl(monthRate, 2)} zł/h` : ''}{row.excluded ? ' · poza średnią' : ''}</Text>
                  </View>
                  <Text style={s.payAmount}>{pl(row.amount, 2)} zł</Text>
                  <TouchableOpacity style={[s.miniBtn, confirmed && s.miniBtnOn]} onPress={() => confirmMonth(row.month, row.amount, row.hours)} hitSlop={6} accessibilityLabel="Potwierdź miesiąc">
                    <Check size={13} color={confirmed ? colors.bg.primary : colors.text.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.miniBtn} onPress={() => toggleExcludeMonth(row.month)} hitSlop={6} accessibilityLabel="Wyklucz ze średniej">
                    {row.excluded ? <EyeOff size={13} color={colors.text.muted} /> : <Eye size={13} color={colors.text.secondary} />}
                  </TouchableOpacity>
                </View>
              );
            })}
            {payMonths.length > 0 && <Text style={s.note}>Ptaszek = miesiąc potwierdzony · oko = liczony do średniej</Text>}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <AppBottomSheet visible={editOpen && !!viewing} onClose={() => setEditOpen(false)}>
        {viewing && (
          <>
            <Text style={s.sheetTitle}>Edytuj pracodawcę</Text>
            <Text style={s.label}>Nazwa</Text>
            <TextInput value={viewing.name} onChangeText={(t) => updateEmployer(viewing.id, { name: t })} style={s.input} placeholder="Nazwa pracodawcy" placeholderTextColor={colors.text.muted} />

            <View style={[s.rowBetween, s.spaced]}>
              <TouchableOpacity
                style={[s.pillBtn, viewing.id === activeEmployerId && s.pillBtnOn]}
                onPress={() => { haptic.success(); setActiveEmployer(viewing.id); }}
                activeOpacity={0.8}
                disabled={viewing.id === activeEmployerId}
              >
                <CheckCircle2 size={13} color={viewing.id === activeEmployerId ? colors.bg.primary : colors.text.secondary} />
                <Text style={[s.pillLabel, viewing.id === activeEmployerId && s.pillLabelOn]}>{viewing.id === activeEmployerId ? 'Aktywny' : 'Ustaw jako aktywny'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.pillBtn} onPress={() => toggleEmployerHidden(viewing.id)} activeOpacity={0.8}>
                {viewing.hidden ? <EyeOff size={13} color={colors.text.muted} /> : <Eye size={13} color={colors.text.secondary} />}
                <Text style={s.pillLabel}>{viewing.hidden ? 'Ukryty w sumach' : 'Liczony w sumach'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.label, s.spaced]}>Tryb liczenia</Text>
            <Segmented
              options={[{ key: 'calendar', label: 'Kalendarz' }, { key: 'manual', label: 'Ręczny' }]}
              activeKey={viewing.workMode ?? 'calendar'}
              onChange={(k) => updateEmployer(viewing.id, { workMode: k as 'calendar' | 'manual' })}
            />
            {isCalendar ? (
              <>
                <Text style={[s.label, s.spaced]}>Prefiks (np. "[JD]")</Text>
                <TextInput value={viewing.workPrefix ?? ''} onChangeText={(t) => updateEmployer(viewing.id, { workPrefix: t })} style={s.input} placeholder="[JD]" placeholderTextColor={colors.text.muted} autoCapitalize="none" />
                <Text style={s.note}>Zmiany w kalendarzu i wypłata w Finansach z tym prefiksem — reszta liczy się sama.</Text>
              </>
            ) : (
              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, s.spaced]}>Pensja / mies.</Text>
                  <NumberInput value={viewing.monthlySalary} onChangeValue={(n) => updateEmployer(viewing.id, { monthlySalary: n ?? 0 })} style={s.input} placeholder="4500" placeholderTextColor={colors.text.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, s.spaced]}>Godziny / mies.</Text>
                  <NumberInput value={viewing.hoursPerMonth} onChangeValue={(n) => updateEmployer(viewing.id, { hoursPerMonth: n ?? 0 })} style={s.input} placeholder="160" placeholderTextColor={colors.text.muted} />
                </View>
              </View>
            )}

            <TouchableOpacity style={[s.summaryRow, s.spaced]} onPress={() => setOverridesOpen((v) => !v)} activeOpacity={0.7}>
              <Text style={s.label}>Nadpisania (opcjonalne)</Text>
              {overridesOpen ? <ChevronUp size={16} color={colors.text.muted} /> : <ChevronDown size={16} color={colors.text.muted} />}
            </TouchableOpacity>
            {overridesOpen && (
              <>
                <View style={s.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.label, s.spaced]}>Stała zł/h</Text>
                    <NumberInput value={viewing.rateOverride} onChangeValue={(n) => updateEmployer(viewing.id, { rateOverride: n || undefined })} style={s.input} placeholder="35" placeholderTextColor={colors.text.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.label, s.spaced]}>Kwota wypłaty</Text>
                    <NumberInput value={viewing.salaryOverride} onChangeValue={(n) => updateEmployer(viewing.id, { salaryOverride: n || undefined })} style={s.input} placeholder="4200" placeholderTextColor={colors.text.muted} />
                  </View>
                </View>
                <View style={s.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.label, s.spaced]}>Godziny (ost. mies.)</Text>
                    <NumberInput value={viewing.hoursOverride} onChangeValue={(n) => updateEmployer(viewing.id, { hoursOverride: n || undefined })} style={s.input} placeholder="160" placeholderTextColor={colors.text.muted} />
                  </View>
                  {isCalendar && (
                    <View style={{ flex: 1 }}>
                      <Text style={[s.label, s.spaced]}>Kolor wydarzeń</Text>
                      <TextInput value={viewing.workColor ?? ''} onChangeText={(t) => updateEmployer(viewing.id, { workColor: t || undefined })} style={s.input} placeholder="#FF0000" placeholderTextColor={colors.text.muted} autoCapitalize="none" />
                    </View>
                  )}
                </View>
                {isCalendar && (
                  <View style={s.twoCol}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.label, s.spaced]}>Pensja zapasowa</Text>
                      <NumberInput value={viewing.monthlySalary} onChangeValue={(n) => updateEmployer(viewing.id, { monthlySalary: n ?? 0 })} style={s.input} placeholder="4500" placeholderTextColor={colors.text.muted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.label, s.spaced]}>Godziny zapasowe</Text>
                      <NumberInput value={viewing.hoursPerMonth} onChangeValue={(n) => updateEmployer(viewing.id, { hoursPerMonth: n ?? 0 })} style={s.input} placeholder="160" placeholderTextColor={colors.text.muted} />
                    </View>
                  </View>
                )}
                <Text style={s.note}>Zapasowe działają tylko, dopóki nie ma realnych zmian i wypłat.</Text>
              </>
            )}
          </>
        )}
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },

  empRow: { paddingHorizontal: spacing[4], gap: spacing[2], paddingBottom: spacing[2] },
  empChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated,
  },
  empChipOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  empChipHidden: { opacity: 0.5 },
  empChipLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  empChipLabelOn: { color: c.bg.primary },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], paddingHorizontal: spacing[6] },
  emptyText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', lineHeight: 19 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.text.bright, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  addBtnLabel: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },

  scroll: { padding: spacing[4], paddingTop: spacing[2] },
  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], marginBottom: spacing[3] },

  heroHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  heroName: { fontSize: 18, fontFamily: 'Inter_900Black', color: c.text.primary },
  heroSub: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 2 },
  payBig: { fontSize: 36, fontFamily: 'Inter_900Black', color: c.text.primary, letterSpacing: -1.2, marginTop: spacing[4], fontVariant: ['tabular-nums'] },
  payCur: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.muted, letterSpacing: 0 },
  paySub: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 2 },
  hoursBlock: { marginTop: spacing[3], gap: 6 },
  track: { height: 6, borderRadius: 3, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: c.text.bright },
  hoursText: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  grid: { flexDirection: 'row', marginTop: spacing[4] },
  gridCell: { flex: 1 },
  gridNum: { fontSize: 22, fontFamily: 'Inter_900Black', color: c.text.primary, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  gridUnit: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 1 },
  gridSub: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },

  label: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  note: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[2], lineHeight: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderTopWidth: 1, borderTopColor: c.border.default, paddingTop: spacing[2], marginTop: spacing[2] },
  rowMain: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  rowMid: { flex: 1, fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted },
  rowRight: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  rowSub: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },
  payAmount: { fontSize: 13.5, fontFamily: 'Inter_900Black', color: c.accent.green },
  miniBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: c.bg.elevated },
  miniBtnOn: { backgroundColor: c.accent.green },

  sheetTitle: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary, marginBottom: spacing[3] },
  spaced: { marginTop: spacing[3] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  twoCol: { flexDirection: 'row', gap: spacing[2] },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  pillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: 8,
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated, flexShrink: 1,
  },
  pillBtnOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  pillLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  pillLabelOn: { color: c.bg.primary },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    marginTop: spacing[2], borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary,
  },
}));
