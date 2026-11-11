import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { ChevronLeft, Plus, Trash2, Bell, BellOff, Check, Edit2, CalendarDays } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { useSubscriptionsStore } from '@/store/subscriptionsStore';
import { CYCLE_LABEL, CYCLE_SHORT, type BillingCycle, type Subscription } from '@/types/subscriptions';
import { billTagFor, advanceNextBillingDate, rollOverdueSubscription, isDurationExpired } from '@/utils/recurringBills';
import { todayISO, ymd } from '@/utils/date';
import { haptic } from '@/utils/haptics';

// Ekran "Stałe opłaty" / Subskrypcje (2026-11-09, user: "czy w sapp mozemy
// eksportować szablony te do łapania powiadomien i stałych? Zeby przeniesc je do
// sapp2? I wtedy w kafelku tam w stałych opłatach zaznaczyć kiedy co musimy
// opłacić") — satelicki ekran (ten sam wzorzec co app/work.tsx/app/vehicles.tsx:
// SafeAreaView+ręczny header, jeden scroll). Port logiki cyklu rozliczeniowego z
// sapp (`utils/recurringBills.ts`'s nowa część — `advanceNextBillingDate`/
// `rollOverdueSubscription`/`isDurationExpired`), formularz UPROSZCZONY vs sapp:
// bez pola kategorii (sapp2 nie ma kategorii — patrz src/types/subscriptions.ts
// po pełny opis co ucięte i czemu, w tym ŚWIADOMIE pominięty bank-auto-matching).
//
// "Stałe opłaty" feeduje DWA miejsca: Finanse's "Najbliższa opłata" StatTile
// (app/(tabs)/finances.tsx) i Dashboard's "Najbliższe eventy" listę jako
// `kind:'bill'` wpisy (app/(tabs)/index.tsx) — ten typ już istniał w
// `DashData.upcoming` (projekt wcześniej przewidział rachunki tam), tylko nic go
// dotąd nie zasilało.

const CYCLES: BillingCycle[] = ['weekly', 'monthly', 'quarterly', 'yearly'];
const DURATION_OPTS = [0, 1, 2, 3, 6, 12];
const REMINDER_OPTS = [0, 1, 3, 7];

function daysUntil(isoDate: string, now = new Date()): number {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${isoDate}T00:00:00`).getTime() - today.getTime()) / 86400000);
}
function urgencyColor(days: number): string {
  if (days <= 3) return colors.accent.red;
  if (days <= 7) return colors.accent.orange;
  return colors.accent.green;
}
function nextLabel(days: number): string {
  if (days < 0) return 'zaległa';
  if (days === 0) return 'dziś';
  if (days === 1) return 'jutro';
  return `za ${days} dni`;
}
// DD.MM.RRRR (ludzki wpis) <-> YYYY-MM-DD (ISO, jak w store/porcie z sapp).
function toDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
}
function parseDisplayDate(str: string): string | null {
  const parts = str.split('.');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

interface FormState {
  name: string;
  amount: string;
  billingCycle: BillingCycle;
  nextBillingDate: string; // display DD.MM.RRRR
  durationMonths: number;
  reminderDaysBefore: number;
  tags: string;
  note: string;
}
function emptyForm(): FormState {
  const d = new Date(); d.setDate(d.getDate() + 30);
  return {
    name: '', amount: '', billingCycle: 'monthly',
    nextBillingDate: toDisplayDate(ymd(d)),
    durationMonths: 0, reminderDaysBefore: 3, tags: '', note: '',
  };
}
function subToForm(sub: Subscription): FormState {
  return {
    name: sub.name, amount: String(sub.amount), billingCycle: sub.billingCycle,
    nextBillingDate: toDisplayDate(sub.nextBillingDate),
    durationMonths: sub.durationMonths ?? 0, reminderDaysBefore: sub.reminderDaysBefore,
    tags: (sub.tags ?? []).join(', '), note: sub.note ?? '',
  };
}
const parseTags = (s: string): string[] => s.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);

export default function SubscriptionsScreen() {
  const s = makeS();
  const subscriptions = useSubscriptionsStore((st) => st.subscriptions);
  const addSubscription = useSubscriptionsStore((st) => st.addSubscription);
  const updateSubscription = useSubscriptionsStore((st) => st.updateSubscription);
  const deleteSubscription = useSubscriptionsStore((st) => st.deleteSubscription);

  // Auto-wyłącz subskrypcje z wygasłym czasem trwania, cicho przesuń zaległe
  // `nextBillingDate` w przyszłość — port 1:1 sapp's efektu w
  // app/expenses/subscriptions.tsx, raz na wejście na ekran.
  const checkedRef = useRef(false);
  useEffect(() => {
    if (checkedRef.current || subscriptions.length === 0) return;
    checkedRef.current = true;
    const today = todayISO();
    for (const sub of subscriptions) {
      if (sub.active && isDurationExpired(sub)) { updateSubscription(sub.id, { active: false }); continue; }
      if (!sub.active) continue;
      const roll = rollOverdueSubscription(sub, today);
      if (roll) updateSubscription(sub.id, { nextBillingDate: roll.nextBillingDate, missedCycles: roll.missedCycles });
    }
  }, [subscriptions]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => { haptic.tap(); setEditing(null); setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (sub: Subscription) => { haptic.tap(); setEditing(sub); setForm(subToForm(sub)); setFormOpen(true); };

  const openDatePicker = () => {
    haptic.tap();
    const iso = parseDisplayDate(form.nextBillingDate) ?? todayISO();
    DateTimePickerAndroid.open({
      value: new Date(`${iso}T12:00:00`),
      mode: 'date',
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) setF('nextBillingDate', toDisplayDate(ymd(selected)));
      },
    });
  };

  const formAmount = parseFloat(form.amount.replace(',', '.'));
  const canSave = !!form.name.trim() && !isNaN(formAmount) && formAmount > 0 && !!parseDisplayDate(form.nextBillingDate);

  const save = () => {
    const amt = formAmount;
    const dateIso = parseDisplayDate(form.nextBillingDate);
    if (!canSave || !dateIso) return;
    const tags = parseTags(form.tags);
    if (editing) {
      updateSubscription(editing.id, {
        name: form.name.trim(), amount: amt, billingCycle: form.billingCycle, nextBillingDate: dateIso,
        durationMonths: form.durationMonths, reminderDaysBefore: form.reminderDaysBefore,
        tags, note: form.note.trim() || undefined,
      });
    } else {
      addSubscription({
        name: form.name.trim(), amount: amt, billingCycle: form.billingCycle, nextBillingDate: dateIso,
        durationMonths: form.durationMonths, reminderDaysBefore: form.reminderDaysBefore,
        tags, note: form.note.trim() || undefined, active: true,
        startDate: form.durationMonths > 0 ? todayISO() : undefined,
      });
    }
    haptic.success();
    setFormOpen(false);
  };

  const active = useMemo(() => subscriptions.filter((s) => s.active).sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate)), [subscriptions]);
  const inactive = useMemo(() => subscriptions.filter((s) => !s.active), [subscriptions]);

  const monthlyTotal = useMemo(() => active.reduce((sum, sub) => {
    const factor = sub.billingCycle === 'weekly' ? 4.33 : sub.billingCycle === 'quarterly' ? 1 / 3 : sub.billingCycle === 'yearly' ? 1 / 12 : 1;
    return sum + sub.amount * factor;
  }, 0), [active]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Stałe opłaty</Text>
        <TouchableOpacity onPress={openAdd} style={s.backBtn} hitSlop={8}>
          <Plus size={20} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {subscriptions.length > 0 && (
          <View style={s.summaryCard}>
            <View style={s.summaryItem}>
              <Text style={s.summaryVal}>{monthlyTotal.toFixed(2)} zł</Text>
              <Text style={s.summaryLabel}>miesięcznie</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={[s.summaryVal, { color: colors.accent.blue }]}>{active.length}</Text>
              <Text style={s.summaryLabel}>aktywnych</Text>
            </View>
          </View>
        )}

        {formOpen && (
          <View style={s.card}>
            <Text style={s.label}>Nazwa</Text>
            <TextInput value={form.name} onChangeText={(v) => setF('name', v)} style={s.input} placeholder="Netflix, Spotify, siłownia..." placeholderTextColor={colors.text.muted} autoFocus />

            <Text style={[s.label, s.labelSpaced]}>Kwota (zł)</Text>
            <TextInput value={form.amount} onChangeText={(v) => setF('amount', v)} style={s.input} placeholder="49.99" placeholderTextColor={colors.text.muted} keyboardType="decimal-pad" />

            <Text style={[s.label, s.labelSpaced]}>Cykl</Text>
            <View style={s.pillRow}>
              {CYCLES.map((c) => (
                <TouchableOpacity key={c} style={[s.pill, form.billingCycle === c && s.pillOn]} onPress={() => setF('billingCycle', c)} activeOpacity={0.8}>
                  <Text style={[s.pillLabel, form.billingCycle === c && s.pillLabelOn]}>{CYCLE_LABEL[c]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.label, s.labelSpaced]}>Następna płatność</Text>
            {/* Natywny kalendarz (2026-11-11) zamiast ręcznego wpisywania
                "DD.MM.RRRR" — ten sam picker co w wydatkach/zadaniach. */}
            <TouchableOpacity style={[s.input, s.dateBtn]} onPress={openDatePicker} activeOpacity={0.7}>
              <CalendarDays size={14} color={colors.text.secondary} />
              <Text style={s.dateBtnLabel}>{form.nextBillingDate}</Text>
            </TouchableOpacity>

            <Text style={[s.label, s.labelSpaced]}>Czas trwania</Text>
            <View style={s.pillRow}>
              {DURATION_OPTS.map((d) => (
                <TouchableOpacity key={d} style={[s.pill, form.durationMonths === d && s.pillOn]} onPress={() => setF('durationMonths', d)} activeOpacity={0.8}>
                  <Text style={[s.pillLabel, form.durationMonths === d && s.pillLabelOn]}>{d === 0 ? 'Zawsze' : `${d} mies.`}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.label, s.labelSpaced]}>Przypomnienie</Text>
            <View style={s.pillRow}>
              {REMINDER_OPTS.map((r) => (
                <TouchableOpacity key={r} style={[s.pill, form.reminderDaysBefore === r && s.pillOn]} onPress={() => setF('reminderDaysBefore', r)} activeOpacity={0.8}>
                  <Text style={[s.pillLabel, form.reminderDaysBefore === r && s.pillLabelOn]}>{r === 0 ? 'Brak' : r === 1 ? 'Dzień przed' : `${r} dni przed`}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {form.reminderDaysBefore > 0 && (
              <Text style={s.reminderHint}>Powiadomienie o 9:00 rano. Jeśli nie przychodzi, wyłącz optymalizację baterii dla appki (Ustawienia → Alerty).</Text>
            )}

            <Text style={[s.label, s.labelSpaced]}>Tagi (opcjonalnie)</Text>
            <TextInput value={form.tags} onChangeText={(v) => setF('tags', v)} style={s.input} placeholder="np. prąd, dom" placeholderTextColor={colors.text.muted} autoCapitalize="none" />

            <Text style={[s.label, s.labelSpaced]}>Notatka (opcjonalnie)</Text>
            <TextInput value={form.note} onChangeText={(v) => setF('note', v)} style={[s.input, { height: 56, textAlignVertical: 'top' }]} placeholder="np. plan Family" placeholderTextColor={colors.text.muted} multiline />

            <View style={[s.rowBetween, s.labelSpaced]}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setFormOpen(false)} activeOpacity={0.8}>
                <Text style={s.cancelBtnLabel}>Odrzuć</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.addBtn, { flex: 1 }, !canSave && s.btnDisabled]} onPress={save} disabled={!canSave} activeOpacity={0.8}>
                <Check size={16} color={colors.bg.primary} />
                <Text style={s.addBtnLabel}>{editing ? 'Zapisz zmiany' : 'Dodaj'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {subscriptions.length === 0 && !formOpen && (
          <View style={s.empty}>
            <Text style={s.emptyText}>Brak stałych opłat. Dodaj pierwszą, np. czynsz, Netflix, siłownię.</Text>
            <TouchableOpacity style={s.addBtn} onPress={openAdd} activeOpacity={0.8}>
              <Plus size={16} color={colors.bg.primary} />
              <Text style={s.addBtnLabel}>Dodaj opłatę</Text>
            </TouchableOpacity>
          </View>
        )}

        {active.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>AKTYWNE</Text>
            {active.map((sub) => (
              <SubRow key={sub.id} sub={sub} s={s} onEdit={openEdit} onDelete={deleteSubscription} onToggle={(id) => updateSubscription(id, { active: false })} />
            ))}
          </View>
        )}

        {inactive.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>NIEAKTYWNE</Text>
            {inactive.map((sub) => (
              <SubRow key={sub.id} sub={sub} s={s} onEdit={openEdit} onDelete={deleteSubscription} onToggle={(id) => updateSubscription(id, { active: true })} />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SubRow({ sub, s, onEdit, onDelete, onToggle }: {
  sub: Subscription; s: ReturnType<typeof makeS>;
  onEdit: (sub: Subscription) => void; onDelete: (id: string) => void; onToggle: (id: string) => void;
}) {
  const bill = billTagFor({ note: sub.note, tags: sub.tags, storeName: sub.name });
  const Icon = bill ? (LucideIcons as any)[bill.icon] : null;
  const days = daysUntil(sub.nextBillingDate);
  const color = urgencyColor(days);

  return (
    <View style={[s.item, !sub.active && s.itemInactive]}>
      <View style={[s.itemIcon, { backgroundColor: color + '18' }]}>
        {Icon ? <Icon size={16} color={sub.active ? color : colors.text.muted} /> : <Bell size={14} color={sub.active ? color : colors.text.muted} />}
      </View>
      <View style={s.itemBody}>
        <Text style={[s.itemName, !sub.active && { color: colors.text.muted }]} numberOfLines={1}>{sub.name}</Text>
        <Text style={s.itemSub} numberOfLines={1}>
          {sub.amount.toFixed(2)} zł{CYCLE_SHORT[sub.billingCycle]} · {toDisplayDate(sub.nextBillingDate)}
        </Text>
      </View>
      <View style={s.itemActions}>
        <View style={[s.daysBadge, { backgroundColor: sub.active ? color + '20' : 'transparent' }]}>
          <Text style={[s.daysBadgeLabel, { color: sub.active ? color : colors.text.muted }]}>{sub.active ? nextLabel(days) : 'off'}</Text>
        </View>
        <View style={s.actionBtns}>
          <TouchableOpacity onPress={() => { haptic.tap(); onToggle(sub.id); }} style={s.iconBtn} hitSlop={6}>
            {sub.active ? <BellOff size={14} color={colors.text.muted} /> : <Check size={14} color={colors.accent.green} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onEdit(sub)} style={s.iconBtn} hitSlop={6}>
            <Edit2 size={13} color={colors.text.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { haptic.medium(); onDelete(sub.id); }} style={s.iconBtn} hitSlop={6}>
            <Trash2 size={14} color={colors.accent.red} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },

  scroll: { padding: spacing[4], paddingTop: spacing[2] },

  summaryCard: { flexDirection: 'row', backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], marginBottom: spacing[3] },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1, backgroundColor: c.border.default },
  summaryVal: { fontSize: 18, fontFamily: 'Inter_900Black', color: c.text.primary },
  summaryLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4 },

  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], marginBottom: spacing[3] },
  label: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelSpaced: { marginTop: spacing[3] },
  input: {
    marginTop: spacing[2], borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dateBtnLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary },
  btnDisabled: { opacity: 0.4 },
  reminderHint: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[2], lineHeight: 15 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  pill: { paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  pillOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  pillLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  pillLabelOn: { color: c.bg.primary },

  cancelBtn: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  cancelBtnLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.muted },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.text.bright, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  addBtnLabel: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },

  empty: { alignItems: 'center', paddingTop: spacing[8], gap: spacing[4], paddingHorizontal: spacing[6] },
  emptyText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', lineHeight: 19 },

  section: { gap: spacing[2], marginTop: spacing[1] },
  sectionTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing[1] },

  item: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3] },
  itemInactive: { opacity: 0.5 },
  itemIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  itemBody: { flex: 1, gap: 2 },
  itemName: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  itemSub: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted },
  itemActions: { alignItems: 'flex-end', gap: spacing[2] },
  daysBadge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm },
  daysBadgeLabel: { fontSize: 10, fontFamily: 'Inter_900Black' },
  actionBtns: { flexDirection: 'row', gap: spacing[1] },
  iconBtn: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: c.bg.elevated, alignItems: 'center', justifyContent: 'center' },
}));
