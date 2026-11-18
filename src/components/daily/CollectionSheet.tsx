import { useMemo, useState, useEffect } from 'react';
import AddExpenseModal from '@/components/finances/AddExpenseModal';
import LazyMount from '@/components/design/LazyMount';
import { txDetail, txColor } from '@/utils/txGroup';
import type { Expense } from '@/types/finances';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Check, Pencil, Trophy, X, CalendarDays, Footprints, Moon, ListChecks, Candy, PiggyBank, TrendingDown, ArrowDownLeft, Receipt } from 'lucide-react-native';
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
import { zl, money } from '@/utils/money';

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

// Karta w stylu kafla "Miesiąc" z Daily (2026-11-17, user: "za duży kontrast, nieczytelne —
// zobacz, jak ładnie wygląda Daily"): jedna duża liczba, cienkie paski z wartościami po
// prawej, wszystko poza liczbami w szarościach, kolor tylko jako akcent (delta, bilans).
export function MonthCardView({ card: c, fresh }: { card: MonthCard; fresh?: boolean }) {
  const s = makeS();
  const max = Math.max(c.fixed, c.variable, c.food, 1);
  const rows: { l: string; v: number; col: string; show: boolean }[] = [
    { l: 'Stałe', v: c.fixed, col: '#60A5FA', show: true },
    { l: 'Zmienne', v: c.variable, col: '#A78BFA', show: true },
    { l: 'Jedzenie', v: c.food, col: '#FBBF24', show: true },
    { l: 'Słodycze', v: c.sweets, col: '#FB7185', show: c.sweets > 0 },
    { l: 'Prąd', v: c.prad, col: '#FACC15', show: c.prad > 0 },
  ];
  const delta = c.vsAvg == null ? null : { text: `${c.vsAvg > 0 ? '+' : ''}${c.vsAvg}% vs średnia`, color: Math.abs(c.vsAvg) < 5 ? colors.text.secondary : c.vsAvg < 0 ? colors.accent.green : colors.accent.orange };
  const extra = [
    c.income > 0 ? `wpływy ${money(c.income)}` : null,
    c.steps != null ? `${c.steps.toLocaleString('pl-PL')} kroków/dzień` : null,
    c.sleepMin != null ? `sen ${fmtDur(c.sleepMin)}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <View style={[s.card, fresh && s.cardFresh]}>
      <View style={s.cardHead}>
        <Text style={s.cardMonth}>{c.label.charAt(0).toUpperCase() + c.label.slice(1)}</Text>
        {fresh ? <Text style={s.freshTag}>nowa</Text> : c.badges[0] ? (
          <View style={s.badge}><Trophy size={11} color="#FBBF24" /><Text style={s.badgeTxt}>{c.badges[0]}</Text></View>
        ) : null}
      </View>
      <View style={s.bigRow}>
        <FitText style={s.big} numberOfLines={1}>{money(c.spent)}<Text style={s.bigUnit}> zł</Text></FitText>
        {delta && <Text style={[s.vs, { color: delta.color }]}>{delta.text}</Text>}
      </View>
      <Text style={s.cap}>wydatki · {c.count} płatności</Text>

      <View style={s.rowsBox}>
        {rows.filter((r) => r.show).map((r) => (
          <View key={r.l} style={s.prow}>
            <Text style={s.plabel}>{r.l}</Text>
            <View style={s.ptrack}><View style={[s.pfill, { width: `${Math.min(100, (r.v / max) * 100)}%`, backgroundColor: r.col }]} /></View>
            <Text style={s.pvalue}>{money(r.v)}</Text>
          </View>
        ))}
        {c.income > 0 && (
          <View style={s.prow}>
            <Text style={s.plabel}>Bilans</Text>
            <View style={{ flex: 1 }} />
            <Text style={[s.pvalue, { color: c.balance >= 0 ? colors.accent.green : colors.accent.orange }]}>{c.balance >= 0 ? '+' : '−'}{money(Math.abs(c.balance))}</Text>
          </View>
        )}
      </View>

      {extra ? <Text style={s.foot}>{extra}</Text> : null}
      {c.top.length > 0 && <Text style={s.foot}>najwięcej: <Text style={s.footHi}>{c.top.map((t) => t.label).join(', ')}</Text></Text>}
      {c.biggest.length > 0 && <Text style={s.foot} numberOfLines={2}>najdroższe (bez stałych): <Text style={s.footHi}>{c.biggest.map((b) => `${b.name} ${money(b.amount)} zł`).join(', ')}</Text></Text>}
      {c.badges.length > 1 && <Text style={s.foot}>🏆 {c.badges.slice(1).join(' · ')}</Text>}
    </View>
  );
}

// Rekordy jako kafelki (2026-11-18, user: "ogarnąłeś wizualnie lepiej rekordy?" — była długa,
// jednolita lista): dwie grupy (Ty / Pieniądze), siatka 2 kolumn, ikona w kolorze rekordu,
// duża wartość, data pod spodem. Stuknięcie kafla = edycja (edytowany kafel na całą szerokość),
// ptaszek w rogu = potwierdź.
const REC_UI: Record<RecordKey, { short: string; icon: typeof Check; color: string }> = {
  steps: { short: 'Kroki w dzień', icon: Footprints, color: '#4ADE80' },
  sleep: { short: 'Najdłuższy sen', icon: Moon, color: '#A78BFA' },
  tasksDay: { short: 'Zadania w dzień', icon: ListChecks, color: '#60A5FA' },
  noSweets: { short: 'Bez słodyczy', icon: Candy, color: '#FB7185' },
  saveMonth: { short: 'Odłożone w mies.', icon: PiggyBank, color: '#22C55E' },
  cheapMonth: { short: 'Najtańszy mies.', icon: TrendingDown, color: '#60A5FA' },
  income: { short: 'Największy wpływ', icon: ArrowDownLeft, color: '#22C55E' },
  bigExpense: { short: 'Największy wydatek', icon: Receipt, color: '#FBBF24' },
  daySpend: { short: 'Najdroższy dzień', icon: CalendarDays, color: '#FB923C' },
};
const REC_GROUPS: { title: string; keys: RecordKey[] }[] = [
  { title: 'Ty', keys: ['steps', 'sleep', 'tasksDay', 'noSweets'] },
  { title: 'Pieniądze', keys: ['saveMonth', 'cheapMonth', 'income', 'bigExpense', 'daySpend'] },
];

function RecordsView({ data }: { data: Partial<Record<RecordKey, Rec>> }) {
  const s = makeS();
  const manual = useCollectionStore((st) => st.manual);
  const confirmed = useCollectionStore((st) => st.confirmed);
  const setManual = useCollectionStore((st) => st.setManual);
  const confirm = useCollectionStore((st) => st.confirm);
  const expenses = useExpensesStore((st) => st.expenses);
  const byId = useMemo(() => new Map(expenses.map((e) => [e.id, e])), [expenses]);
  const [open, setOpen] = useState<RecordKey | null>(null);   // szczegóły: skąd rekord
  const [edit, setEdit] = useState<RecordKey | null>(null);   // ręczny wpis
  const [editExp, setEditExp] = useState<Expense | null>(null);

  return (
    <View style={{ gap: spacing[3] }}>
      {REC_GROUPS.map((g) => (
        <View key={g.title} style={s.recBox}>
          <Text style={s.recGroup}>{g.title}</Text>
          <View style={s.recGrid}>
            {g.keys.map((k) => {
              const def = RECORD_DEFS.find((d) => d.key === k)!;
              const ui = REC_UI[k];
              const Icon = ui.icon;
              const best = bestRecord(def, data[k], manual[k]);
              const sig = best ? recordSig(best.rec) : null;
              const isConfirmed = !!sig && confirmed[k] === sig;
              const isNew = best?.source === 'data' && !isConfirmed && !!confirmed[k];
              const v = best ? fmtValue(def, best.rec.value) : '—';
              const m = k !== 'sleep' ? /^(.*\d)\s(\D+)$/.exec(v) : null;
              const value = (
                <FitText style={[s.recValue, !best && { color: colors.text.muted }]} numberOfLines={1}>
                  {m ? m[1] : v}{m ? <Text style={s.recUnit}>{` ${m[2]}`}</Text> : null}
                </FitText>
              );
              const head = (wide: boolean) => (
                <View style={s.recHead}>
                  <View style={[s.recIcon, { backgroundColor: ui.color + '22' }]}><Icon size={13} color={ui.color} /></View>
                  <Text style={s.recLabel} numberOfLines={2}>{wide ? def.label : ui.short}</Text>
                  {wide ? (
                    <TouchableOpacity hitSlop={10} accessibilityLabel="Zamknij" onPress={() => { setOpen(null); setEdit(null); }}>
                      <X size={15} color={colors.text.muted} />
                    </TouchableOpacity>
                  ) : best ? (
                    <TouchableOpacity hitSlop={10} accessibilityLabel="Potwierdź rekord" onPress={() => { haptic.tap(); confirm(k, isConfirmed ? null : sig); }}>
                      <Check size={14} color={isConfirmed ? colors.accent.green : colors.text.muted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              );

              if (edit === k) return (
                <View key={k} style={[s.recTile, s.recTileWide]}>
                  {head(true)}
                  <RecordEditor def={def} initial={manual[k] ?? best?.rec} hasManual={!!manual[k]}
                    onCancel={() => setEdit(null)}
                    onSave={(r) => { haptic.success(); setManual(k, r); confirm(k, r ? recordSig(r) : null); setEdit(null); }} />
                </View>
              );

              // Szczegóły (2026-11-18, user: "musi pisać datę i konkretny event, kiedy to wyłapało,
              // żebym mógł zobaczyć i edytować"): kiedy, skąd, powiązane transakcje (stuknij = edycja).
              if (open === k) {
                const linked = (best?.source === 'data' ? best.rec.ids ?? [] : []).map((id) => byId.get(id)).filter(Boolean) as Expense[];
                return (
                  <View key={k} style={[s.recTile, s.recTileWide]}>
                    {head(true)}
                    {value}
                    {best ? (
                      <>
                        <Text style={s.srcLine}>
                          {best.source === 'manual' ? 'Wpisane ręcznie' : 'Złapane z danych'} · {fmtDate(best.rec.date)}{best.rec.note ? ` · ${best.rec.note}` : ''}
                        </Text>
                        {best.source === 'data' && best.rec.detail ? <Text style={s.srcDetail}>{best.rec.detail}</Text> : null}
                        {best.source === 'manual' && data[k] ? <Text style={s.srcDetail}>{`Z danych: ${fmtValue(def, data[k]!.value)} (${fmtDate(data[k]!.date)}) — Twój wpis jest lepszy.`}</Text> : null}
                        {linked.map((e) => (
                          <TouchableOpacity key={e.id} style={s.srcTx} activeOpacity={0.75} onPress={() => { haptic.tap(); setEditExp(e); }} accessibilityLabel={`Edytuj ${e.storeName || e.note || 'transakcję'}`}>
                            <View style={[s.srcDot, { backgroundColor: txColor(e) }]} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={s.srcTxName} numberOfLines={1}>{e.storeName || e.note || (e.type === 'income' ? 'Przychód' : 'Wydatek')}</Text>
                              <Text style={s.srcTxSub} numberOfLines={1}>{[fmtDate(e.date.slice(0, 10)), txDetail(e)].filter(Boolean).join(' · ')}</Text>
                            </View>
                            <Text style={[s.srcTxAmt, e.type === 'income' && { color: colors.accent.green }]}>{e.type === 'income' ? '+' : '−'}{money(e.amount)} zł</Text>
                            <Pencil size={12} color={colors.text.muted} />
                          </TouchableOpacity>
                        ))}
                        {best.source === 'data' && (best.rec.ids?.length ?? 0) > linked.length ? <Text style={s.srcDetail}>Część transakcji została usunięta.</Text> : null}
                      </>
                    ) : <Text style={s.srcDetail}>Brak danych — wpisz swój wynik ręcznie.</Text>}
                    <View style={s.srcBtns}>
                      {best && (
                        <TouchableOpacity style={[s.srcBtn, isConfirmed && s.srcBtnOn]} onPress={() => { haptic.tap(); confirm(k, isConfirmed ? null : sig); }}>
                          <Check size={13} color={isConfirmed ? colors.accent.green : colors.text.secondary} />
                          <Text style={[s.srcBtnTxt, isConfirmed && { color: colors.accent.green }]}>{isConfirmed ? 'Potwierdzone' : 'Potwierdź'}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={s.srcBtn} onPress={() => { haptic.tap(); setEdit(k); }}>
                        <Pencil size={12} color={colors.text.secondary} />
                        <Text style={s.srcBtnTxt}>{manual[k] ? 'Zmień ręczny wpis' : 'Wpisz ręcznie'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }

              return (
                <TouchableOpacity key={k} style={s.recTile} activeOpacity={0.8} accessibilityLabel="Szczegóły rekordu"
                  onPress={() => { haptic.tap(); setEdit(null); setOpen(k); }}>
                  {head(false)}
                  {value}
                  <Text style={[s.recMeta, isNew && { color: '#D4B062' }]} numberOfLines={1}>
                    {isNew ? 'nowy rekord · ' : ''}{best ? `${fmtDate(best.rec.date)}${best.rec.note ? ` · ${best.rec.note}` : ''}${best.source === 'manual' ? ' · ręcznie' : ''}` : 'stuknij, by wpisać'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
      <Text style={s.note}>Liczone z Twoich danych (wydatki bez stałych opłat). Stuknij kafel: zobaczysz, skąd jest wynik i które transakcje go dały — możesz je poprawić albo wpisać własny lepszy wynik. Ptaszek = potwierdzony.</Text>
      <LazyMount visible={!!editExp}>
        <AddExpenseModal visible={!!editExp} onClose={() => setEditExp(null)} editingExpense={editExp} />
      </LazyMount>
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
          placeholderTextColor={colors.text.muted} style={[s.input, { flex: 1, minWidth: 0 }]} autoFocus />
        <Text style={s.edUnit}>{isSleep ? 'h' : def.unit}</Text>
      </View>
      <View style={s.edRow}>
        <TouchableOpacity style={s.dateBtn} onPress={pickDate}>
          <CalendarDays size={14} color={colors.text.secondary} />
          <Text style={s.dateTxt}>{fmtDate(date)}</Text>
        </TouchableOpacity>
      </View>
      <TextInput value={note} onChangeText={setNote} placeholder="notatka, np. Kraków pieszo" placeholderTextColor={colors.text.muted} style={[s.input, { minWidth: 0 }]} />
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
  note: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_500Medium', color: c.text.muted, marginBottom: spacing[2], marginTop: spacing[1] },

  card: { backgroundColor: c.ui.in, borderRadius: 18, padding: spacing[4], marginBottom: spacing[3] },
  cardFresh: { borderWidth: 1, borderColor: c.text.muted },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  cardMonth: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.primary },
  freshTag: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeTxt: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: '#D4B062' },
  bigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], marginTop: 6 },
  big: { flex: 1, fontSize: 34, fontFamily: 'Inter_900Black', color: c.text.bright, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  bigUnit: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.muted, letterSpacing: 0 },
  vs: { fontSize: 11.5, fontFamily: 'Inter_800ExtraBold', paddingBottom: 7 },
  cap: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  rowsBox: { gap: 8, marginTop: spacing[3], marginBottom: spacing[2] },
  prow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], height: 18 },
  plabel: { width: 70, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.primary },
  ptrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.ui.in2, overflow: 'hidden' },
  pfill: { height: '100%', borderRadius: 3, opacity: 0.85 },
  pvalue: { width: 74, textAlign: 'right', fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.bright, fontVariant: ['tabular-nums'] },
  foot: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  footHi: { color: c.text.secondary },

  recBox: { backgroundColor: c.ui.in, borderRadius: 18, padding: spacing[3], gap: spacing[2] },
  recGroup: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 4 },
  recGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recTile: { flexGrow: 1, flexBasis: '45%', minWidth: 0, backgroundColor: c.ui.in2, borderRadius: 14, padding: 12, gap: 6 },
  recTileWide: { flexBasis: '100%' },
  recHead: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 22 },
  recIcon: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  recLabel: { flex: 1, fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  recValue: { fontSize: 19, fontFamily: 'Inter_900Black', color: c.text.bright, fontVariant: ['tabular-nums'] },
  srcLine: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  srcDetail: { fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter_500Medium', color: c.text.muted },
  srcTx: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: c.ui.in, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8 },
  srcDot: { width: 8, height: 8, borderRadius: 4 },
  srcTxName: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  srcTxSub: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 1 },
  srcTxAmt: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.secondary, fontVariant: ['tabular-nums'] },
  srcBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  srcBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 7 },
  srcBtnOn: { borderColor: c.accent.green },
  srcBtnTxt: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  recUnit: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted },
  recMeta: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  icon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
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
