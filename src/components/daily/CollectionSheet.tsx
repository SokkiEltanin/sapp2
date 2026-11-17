import { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Check, Pencil, Trophy, X, CalendarDays } from 'lucide-react-native';
import FitText from '@/ui/FitText';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useExpensesStore } from '@/store/expensesStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useCollectionStore } from '@/store/collectionStore';
import { buildMonthCards, monthLabel, type MonthCard } from '@/utils/monthCards';
import { computeRecords, bestRecord, recordSig, RECORD_DEFS, type RecordDef, type RecordKey, type Rec } from '@/utils/records';
import { fmtDur } from '@/utils/sleepStats';
import { openPicker } from '@/services/picker';
import { haptic } from '@/utils/haptics';
import { zl } from '@/utils/money';

// Kolekcja (2026-11-17): Karty miesięcy (utils/monthCards.ts) i Rekordy (utils/records.ts).
// Otwierana z kafla "Miesiąc" w Daily (przycisk "karty") i SAMA 1. dnia miesiąca, gdy
// jest nowa karta (`highlight` = świeża karta na górze z napisem "Nowa karta").
export function useCollectionData() {
  const expenses = useExpensesStore((st) => st.expenses);
  const tasks = useCalendarStore((st) => st.tasks);
  const log = useCollectionStore((st) => st.healthLog);
  const cards = useMemo(() => buildMonthCards(expenses, log), [expenses, log]);
  const records = useMemo(() => computeRecords(expenses, log, tasks, cards), [expenses, log, tasks, cards]);
  return { cards, records };
}

const fmtDate = (d: string) => (d.length === 7 ? monthLabel(d) : `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`);
function fmtValue(def: RecordDef, v: number): string {
  if (def.money) return zl(v);
  if (def.key === 'sleep') return fmtDur(v);
  return `${Math.round(v).toLocaleString('pl-PL')} ${def.unit}`;
}

export default function CollectionSheet({ visible, onClose, highlight }: { visible: boolean; onClose: () => void; highlight?: string | null }) {
  const s = makeS();
  const [tab, setTab] = useState<'cards' | 'records'>('cards');
  useEffect(() => { if (visible && highlight) setTab('cards'); }, [visible, highlight]);
  const { cards, records } = useCollectionData();

  return (
    <AppBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.92}
      header={
        <View style={{ paddingBottom: spacing[2] }}>
          <Text style={s.title}>{highlight ? 'Nowa karta do kolekcji' : 'Kolekcja'}</Text>
          <View style={s.tabs}>
            {([['cards', `Karty miesięcy · ${cards.length}`], ['records', 'Rekordy']] as const).map(([k, l]) => (
              <TouchableOpacity key={k} style={[s.tab, tab === k && s.tabOn]} onPress={() => { haptic.tap(); setTab(k); }}>
                <Text style={[s.tabTxt, tab === k && s.tabTxtOn]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      }>
      {tab === 'cards'
        ? (cards.length ? cards.map((c) => <MonthCardView key={c.key} card={c} fresh={c.key === highlight} />)
          : <Text style={s.empty}>Pierwsza karta pojawi się po zakończeniu pierwszego miesiąca z wydatkami.</Text>)
        : <RecordsView data={records} />}
    </AppBottomSheet>
  );
}

export function MonthCardView({ card: c, fresh }: { card: MonthCard; fresh?: boolean }) {
  const s = makeS();
  const accent = c.income > 0 ? (c.balance >= 0 ? colors.accent.green : colors.accent.red) : colors.text.muted;
  const parts = [
    { l: 'Stałe', v: c.fixed, col: '#60A5FA' },
    { l: 'Zmienne', v: c.variable, col: '#C084FC' },
    { l: 'Jedzenie', v: c.food, col: '#FBBF24' },
  ];
  return (
    <View style={[s.card, { borderColor: fresh ? colors.text.bright : accent + '66' }]}>
      <View style={s.cardHead}>
        <Text style={s.cardMonth}>{c.label}</Text>
        {fresh && <Text style={s.freshTag}>NOWA</Text>}
      </View>
      {c.badges.length > 0 && (
        <View style={s.badges}>
          {c.badges.map((b) => (
            <View key={b} style={s.badge}><Trophy size={11} color="#FBBF24" /><Text style={s.badgeTxt}>{b}</Text></View>
          ))}
        </View>
      )}
      <View style={s.bigRow}>
        <FitText style={s.big} numberOfLines={1}>{zl(c.spent)}</FitText>
        {c.vsAvg != null && (
          <Text style={[s.vs, { color: c.vsAvg <= 0 ? colors.accent.green : colors.accent.orange }]}>{c.vsAvg > 0 ? '+' : ''}{c.vsAvg}% vs śr.</Text>
        )}
      </View>
      <Text style={s.cap}>wydatki · {c.count} płatności</Text>

      <View style={s.bar}>
        {parts.filter((p) => p.v > 0).map((p) => <View key={p.l} style={{ flex: p.v, backgroundColor: p.col }} />)}
      </View>
      <View style={s.partsRow}>
        {parts.map((p) => (
          <View key={p.l} style={s.part}>
            <View style={[s.dot, { backgroundColor: p.col }]} />
            <Text style={s.partL}>{p.l}</Text>
            <Text style={s.partV}>{zl(p.v)}</Text>
          </View>
        ))}
      </View>

      <View style={s.grid}>
        <Cell l="Wpływy" v={c.income > 0 ? zl(c.income) : '—'} />
        <Cell l="Bilans" v={c.income > 0 ? `${c.balance >= 0 ? '+' : ''}${zl(c.balance)}` : '—'} color={c.income > 0 ? accent : undefined} />
        <Cell l="Słodycze" v={zl(c.sweets)} />
        <Cell l="Prąd" v={c.prad > 0 ? zl(c.prad) : '—'} />
        <Cell l="Kroki / dzień" v={c.steps != null ? c.steps.toLocaleString('pl-PL') : '—'} />
        <Cell l="Sen / noc" v={c.sleepMin != null ? fmtDur(c.sleepMin) : '—'} />
      </View>

      {c.top.length > 0 && (
        <Text style={s.line}><Text style={s.lineL}>Najwięcej na: </Text>{c.top.map((t) => `${t.label} ${zl(t.v)}`).join(' · ')}</Text>
      )}
      {c.biggest && (
        <Text style={s.line}><Text style={s.lineL}>Największy wydatek: </Text>{c.biggest.name} · {zl(c.biggest.amount)} · {c.biggest.date.slice(8, 10)}.{c.biggest.date.slice(5, 7)}</Text>
      )}
    </View>
  );
}

function Cell({ l, v, color }: { l: string; v: string; color?: string }) {
  const s = makeS();
  return (
    <View style={s.cell}>
      <FitText style={[s.cellV, color ? { color } : null]} numberOfLines={1}>{v}</FitText>
      <Text style={s.cellL} numberOfLines={1}>{l}</Text>
    </View>
  );
}

function RecordsView({ data }: { data: Partial<Record<RecordKey, Rec>> }) {
  const s = makeS();
  const manual = useCollectionStore((st) => st.manual);
  const confirmed = useCollectionStore((st) => st.confirmed);
  const setManual = useCollectionStore((st) => st.setManual);
  const confirm = useCollectionStore((st) => st.confirm);
  const [edit, setEdit] = useState<RecordKey | null>(null);

  return (
    <View>
      <Text style={s.note}>Liczone z Twoich danych. Pamiętasz lepszy wynik, którego appka nie zna? Stuknij ołówek i wpisz go — zostanie, dopóki go nie pobijesz.</Text>
      {RECORD_DEFS.map((def) => {
        const best = bestRecord(def, data[def.key], manual[def.key]);
        const sig = best ? recordSig(best.rec) : null;
        const isConfirmed = !!sig && confirmed[def.key] === sig;
        const isNew = best?.source === 'data' && !isConfirmed && !!confirmed[def.key];
        return (
          <View key={def.key} style={s.rec}>
            <View style={s.recHead}>
              <Text style={s.recLabel}>{def.label}</Text>
              {isNew && <Text style={s.newTag}>NOWY REKORD</Text>}
            </View>
            {edit === def.key ? (
              <RecordEditor def={def} initial={manual[def.key] ?? best?.rec} hasManual={!!manual[def.key]}
                onCancel={() => setEdit(null)}
                onSave={(r) => { haptic.success(); setManual(def.key, r); confirm(def.key, r ? recordSig(r) : null); setEdit(null); }} />
            ) : (
              <View style={s.recRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.recValue, !best && { color: colors.text.muted }]}>{best ? fmtValue(def, best.rec.value) : 'brak danych'}</Text>
                  {best && (
                    <Text style={s.recMeta} numberOfLines={1}>
                      {fmtDate(best.rec.date)}{best.rec.note ? ` · ${best.rec.note}` : ''} · {best.source === 'manual' ? 'wpisane ręcznie' : 'z danych'}{isConfirmed ? ' · potwierdzone' : ''}
                    </Text>
                  )}
                </View>
                {best && (
                  <TouchableOpacity style={[s.icon, isConfirmed && s.iconOn]} accessibilityLabel="Potwierdź rekord"
                    onPress={() => { haptic.tap(); confirm(def.key, isConfirmed ? null : sig); }}>
                    <Check size={15} color={isConfirmed ? colors.bg.primary : colors.text.secondary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.icon} onPress={() => { haptic.tap(); setEdit(def.key); }} accessibilityLabel="Edytuj rekord">
                  <Pencil size={14} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function RecordEditor({ def, initial, hasManual, onSave, onCancel }: { def: RecordDef; initial?: Rec; hasManual: boolean; onSave: (r: Rec | null) => void; onCancel: () => void }) {
  const s = makeS();
  const isSleep = def.key === 'sleep';
  const monthly = def.key === 'cheapMonth' || def.key === 'saveMonth';
  const [val, setVal] = useState(initial ? String(isSleep ? +(initial.value / 60).toFixed(2) : initial.value).replace('.', ',') : '');
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, monthly ? 7 : 10));
  const [note, setNote] = useState(initial?.note ?? '');
  const num = parseFloat(val.replace(/\s/g, '').replace(',', '.'));
  const pickDate = () => openPicker({
    value: new Date(`${date.length === 7 ? `${date}-01` : date}T12:00:00`), mode: 'date', maximumDate: new Date(),
    onChange: (ev, d) => { if (ev.type === 'set' && d) { const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; setDate(monthly ? iso.slice(0, 7) : iso); } },
  });
  return (
    <View style={s.editor}>
      <View style={s.edRow}>
        <TextInput value={val} onChangeText={setVal} keyboardType="decimal-pad" placeholder={isSleep ? 'godziny, np. 11,5' : def.unit}
          placeholderTextColor={colors.text.muted} style={[s.input, { flex: 1 }]} autoFocus />
        <Text style={s.edUnit}>{isSleep ? 'h' : def.unit}</Text>
      </View>
      <View style={s.edRow}>
        <TouchableOpacity style={s.dateBtn} onPress={pickDate}>
          <CalendarDays size={14} color={colors.text.secondary} />
          <Text style={s.dateTxt}>{fmtDate(date)}</Text>
        </TouchableOpacity>
        <TextInput value={note} onChangeText={setNote} placeholder="notatka, np. Kraków pieszo" placeholderTextColor={colors.text.muted} style={[s.input, { flex: 1 }]} />
      </View>
      <View style={s.edRow}>
        {hasManual && <TouchableOpacity onPress={() => onSave(null)}><Text style={s.edDel}>Usuń ręczny wpis</Text></TouchableOpacity>}
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={s.icon} onPress={onCancel} accessibilityLabel="Anuluj"><X size={15} color={colors.text.secondary} /></TouchableOpacity>
        <TouchableOpacity style={[s.saveBtn, !(num > 0) && { opacity: 0.4 }]} disabled={!(num > 0)}
          onPress={() => onSave({ value: isSleep ? Math.round(num * 60) : num, date, note: note.trim() || undefined })}>
          <Text style={s.saveTxt}>Zapisz</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 18, fontFamily: 'Inter_900Black', color: c.text.bright, marginBottom: spacing[2] },
  tabs: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: radius.md, backgroundColor: c.bg.primary },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.sm },
  tabOn: { backgroundColor: c.text.bright },
  tabTxt: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  tabTxtOn: { color: c.bg.primary },
  empty: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.muted, textAlign: 'center', paddingVertical: spacing[5] },
  note: { fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginBottom: spacing[2] },

  card: { borderWidth: 1.5, borderRadius: radius.lg, padding: spacing[4], marginBottom: spacing[3], backgroundColor: c.bg.primary, gap: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMonth: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.bright, textTransform: 'capitalize', letterSpacing: -0.4 },
  freshTag: { fontSize: 10, fontFamily: 'Inter_900Black', color: c.bg.primary, backgroundColor: c.text.bright, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#FBBF2422' },
  badgeTxt: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: '#FBBF24' },
  bigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], marginTop: 4 },
  big: { flex: 1, fontSize: 32, fontFamily: 'Inter_900Black', color: c.text.bright, letterSpacing: -1 },
  vs: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', paddingBottom: 6 },
  cap: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: -4 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: c.ui.in, marginTop: 6 },
  partsRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 },
  part: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  partL: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  partV: { fontSize: 11.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  cell: { flexGrow: 1, flexBasis: '30%', minWidth: 90, backgroundColor: c.ui.in, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 10 },
  cellV: { fontSize: 15, fontFamily: 'Inter_900Black', color: c.text.bright, fontVariant: ['tabular-nums'] },
  cellL: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 2 },
  line: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', color: c.text.primary, marginTop: 4 },
  lineL: { fontFamily: 'Inter_600SemiBold', color: c.text.muted },

  rec: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.ui.line, gap: 4 },
  recHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  recLabel: { flex: 1, fontSize: 11.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  newTag: { fontSize: 9.5, fontFamily: 'Inter_900Black', color: '#FBBF24' },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  recValue: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.bright, fontVariant: ['tabular-nums'] },
  recMeta: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  icon: { width: 34, height: 34, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: c.accent.green, borderColor: c.accent.green },
  editor: { gap: spacing[2] },
  edRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  edUnit: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted },
  input: { borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: 8, fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 38, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  dateTxt: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  edDel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.accent.red },
  saveBtn: { paddingHorizontal: spacing[4], height: 34, borderRadius: radius.md, backgroundColor: c.text.bright, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },
}));
