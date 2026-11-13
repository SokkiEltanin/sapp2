import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, ChevronDown, ChevronUp, Plus, Check, ShoppingBag, X, Car } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import ReplaceSheet, { ReplaceIcon } from '@/components/replacements/ReplaceSheet';
import LazyMount from '@/components/design/LazyMount';
import { useReplacementsStore } from '@/store/replacementsStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import type { ReplaceItem } from '@/types/replacements';
import { REPLACE_PRESETS, presetByKey, allReplaceRows, shortEvery, pendingBuy, yearlyCost } from '@/utils/replacements';
import { toDisplayDate } from '@/utils/dateInput';
import { todayISO } from '@/utils/date';
import { haptic } from '@/utils/haptics';

// Ekran "Wymiany" (2026-11-13, user: "wszystko z wymianami, filtrów w dzbanku,
// do powietrza itp itd i szczoteczek końcówek"). Zasada 10 — dane na wierzchu:
//   1. Trzy liczby: po terminie / w 7 dni / koszt roczny (z cen na paragonach).
//   2. "Kupione — wymienione?" — zakup pasujący do słów rzeczy po ostatniej
//      wymianie (utils/replacements.ts's pendingBuy): 1 stuknięcie = wymiana z
//      datą zakupu, "nie to" = już nie pytaj o ten paragon.
//   3. Lista od najpilniejszej: pasek zużycia, termin, ✓ = wymienione dziś.
//      Razem z serwisem pojazdów (olej, klocki…; dane w Pojazdach — tap tam,
//      ✓ dopisuje wykonanie do historii pojazdu).
//   4. Szablony do szybkiego dodania — domyślnie zwinięte (user: "zajmują dużo miejsca").
// Konfiguracja (co ile, przypomnienie, słowa, historia) → ReplaceSheet.

// "DD.MM", a z innego roku "DD.MM.RR" (olej sprzed roku nie może udawać tegorocznego).
const shortDate = (iso: string, today: string) =>
  (iso.slice(0, 4) === today.slice(0, 4) ? toDisplayDate(iso).slice(0, 5) : `${toDisplayDate(iso).slice(0, 6)}${iso.slice(2, 4)}`);

export default function ReplacementsScreen() {
  const s = makeS();
  const items = useReplacementsStore((st) => st.items);
  const replaced = useReplacementsStore((st) => st.replaced);
  const dismissBuy = useReplacementsStore((st) => st.dismissBuy);
  const expenses = useExpensesStore((st) => st.expenses);
  const vehicles = useVehiclesStore((st) => st.vehicles);
  const addMaintenance = useVehiclesStore((st) => st.addMaintenance);
  const [presetsOpen, setPresetsOpen] = useState(false);

  const [sheet, setSheet] = useState<{ editing?: ReplaceItem | null; preset?: string | null } | null>(null);
  const today = todayISO();
  const now = useMemo(() => new Date(), [today]);

  const rows = useMemo(() => allReplaceRows(items, vehicles, now), [items, vehicles, now]);
  const buys = useMemo(() => items.map((it) => ({ it, buy: pendingBuy(it, expenses) })).filter((x) => x.buy), [items, expenses]);
  const costs = useMemo(() => new Map(items.map((it) => [it.id, yearlyCost(it, expenses)])), [items, expenses]);
  const overdue = rows.filter((r) => r.due.daysLeft < 0).length;
  const soon = rows.filter((r) => r.due.daysLeft >= 0 && r.due.daysLeft <= 7).length;
  const knownCosts = [...costs.values()].filter((v): v is number => v != null);
  const yearTotal = knownCosts.reduce((a, b) => a + b, 0);
  const missingPresets = REPLACE_PRESETS.filter((p) => !items.some((it) => it.preset === p.key));

  const open = (v: { editing?: ReplaceItem | null; preset?: string | null }) => { haptic.tap(); setSheet(v); };
  const done = (it: ReplaceItem, date: string) => { haptic.success(); replaced(it.id, date); };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headBtn} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Wymiany</Text>
        <TouchableOpacity onPress={() => open({})} style={s.headBtn} hitSlop={8} accessibilityLabel="Dodaj">
          <Plus size={20} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {rows.length === 0 ? (
          <Text style={s.emptyText}>Filtry, końcówki szczoteczki, olej w aucie — dodaj, co wymieniasz, a appka przypomni i pokaże koszt na rok.</Text>
        ) : (
          <View style={s.stats}>
            <View style={s.stat}>
              <Text style={[s.statNum, overdue > 0 && { color: colors.accent.red }]}>{overdue}</Text>
              <Text style={s.statKey}>po terminie</Text>
            </View>
            <View style={s.stat}>
              <Text style={[s.statNum, soon > 0 && { color: colors.accent.orange }]}>{soon}</Text>
              <Text style={s.statKey}>w 7 dni</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statNum}>{knownCosts.length ? `${yearTotal}` : '—'}<Text style={s.statUnit}>{knownCosts.length ? ' zł' : ''}</Text></Text>
              <Text style={s.statKey}>na rok{knownCosts.length && knownCosts.length < rows.length ? ` (${knownCosts.length}/${rows.length})` : ''}</Text>
            </View>
          </View>
        )}

        {buys.map(({ it, buy }) => (
          <View key={it.id} style={s.buy}>
            <ShoppingBag size={16} color={colors.accent.blue} />
            <View style={{ flex: 1 }}>
              <Text style={s.buyTitle} numberOfLines={1}>{it.name} — wymienione?</Text>
              <Text style={s.buySub} numberOfLines={1}>kupione {shortDate(buy!.date, today)}: {buy!.text}{buy!.price ? ` · ${buy!.price.toFixed(2).replace('.', ',')} zł` : ''}</Text>
            </View>
            <TouchableOpacity style={s.buyYes} onPress={() => done(it, buy!.date)} activeOpacity={0.8}>
              <Text style={s.buyYesLabel}>Tak</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { haptic.tap(); dismissBuy(it.id, buy!.expenseId); }} hitSlop={8} accessibilityLabel="To nie to">
              <X size={15} color={colors.text.muted} />
            </TouchableOpacity>
          </View>
        ))}

        {rows.map((r) => {
          const { due } = r;
          const color = due.daysLeft < 0 ? colors.accent.red : due.daysLeft <= 7 ? colors.accent.orange : colors.text.secondary;
          const isCar = r.kind === 'car';
          const lastDate = isCar ? r.car.lastDate : r.item.lastDate;
          const doneToday = lastDate === today;
          const cost = isCar ? null : costs.get(r.item.id);
          const name = isCar ? r.car.label : r.item.name;
          const every = isCar ? shortEvery(r.car.every, 'm') : shortEvery(r.item.every, r.item.unit);
          const onPress = () => {
            haptic.tap();
            if (r.kind === 'car') router.push({ pathname: '/vehicles', params: { id: r.car.vehicleId } } as any);
            else open({ editing: r.item });
          };
          const onDone = () => {
            if (doneToday) return;
            haptic.success();
            if (r.kind === 'car') addMaintenance(r.car.vehicleId, { label: r.car.label, date: today, intervalMonths: r.car.every });
            else replaced(r.item.id, today);
          };
          return (
            <TouchableOpacity key={r.key} style={s.row} onPress={onPress} activeOpacity={0.8}>
              <View style={s.rowTop}>
                <View style={s.icon}>
                  {r.kind === 'car'
                    ? <Car size={16} color={r.car.vehicleColor || colors.text.secondary} />
                    : <ReplaceIcon name={presetByKey(r.item.preset)?.icon} size={16} color={colors.text.secondary} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>
                    {name}{r.kind === 'car' ? <Text style={s.owner}>{`  ${r.car.vehicleName}`}</Text> : null}
                  </Text>
                  <Text style={s.sub} numberOfLines={1}>
                    <Text style={[s.due, { color }]}>{doneToday ? 'wymienione dziś' : due.label}</Text>
                    {` · co ${every} · ost. ${shortDate(lastDate, today)}${cost ? ` · ~${cost} zł/rok` : ''}`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.check, doneToday && s.checkOn]}
                  onPress={onDone}
                  hitSlop={6}
                  accessibilityLabel="Wymienione dziś"
                >
                  <Check size={16} color={doneToday ? colors.bg.primary : colors.text.primary} />
                </TouchableOpacity>
              </View>
              <View style={s.track}>
                <View style={[s.fill, { width: `${Math.min(100, due.used * 100)}%`, backgroundColor: color }]} />
              </View>
            </TouchableOpacity>
          );
        })}

        {missingPresets.length > 0 && (
          <>
            <TouchableOpacity style={s.presetsHead} onPress={() => { haptic.tap(); setPresetsOpen((v) => !v); }} activeOpacity={0.7}>
              <Text style={s.section}>Szablony ({missingPresets.length})</Text>
              {presetsOpen ? <ChevronUp size={14} color={colors.text.muted} /> : <ChevronDown size={14} color={colors.text.muted} />}
            </TouchableOpacity>
            {presetsOpen && <View style={s.quick}>
              {missingPresets.map((p) => (
                <TouchableOpacity key={p.key} style={s.quickItem} onPress={() => open({ preset: p.key })} activeOpacity={0.8}>
                  <ReplaceIcon name={p.icon} size={13} color={colors.text.secondary} />
                  <Text style={s.quickLabel} numberOfLines={1}>{p.name}</Text>
                  <Text style={s.quickEvery}>{shortEvery(p.every, p.unit)}</Text>
                </TouchableOpacity>
              ))}
            </View>}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <LazyMount visible={!!sheet}>
        <ReplaceSheet visible={!!sheet} onClose={() => setSheet(null)} editing={sheet?.editing} presetKey={sheet?.preset} />
      </LazyMount>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  headBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  scroll: { padding: spacing[4], paddingTop: spacing[2], gap: spacing[2] },
  emptyText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.muted, lineHeight: 19, marginBottom: spacing[2] },

  stats: { flexDirection: 'row', gap: spacing[2] },
  stat: { flex: 1, backgroundColor: c.bg.card, borderRadius: radius.lg, paddingVertical: spacing[3], paddingHorizontal: spacing[3] },
  statNum: { fontSize: 22, fontFamily: 'Inter_900Black', color: c.text.primary, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted },
  statKey: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1 },

  buy: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.accent.blue + '44', padding: spacing[3] },
  buyTitle: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  buySub: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 1 },
  buyYes: { paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radius.md, backgroundColor: c.text.bright },
  buyYesLabel: { fontSize: 12, fontFamily: 'Inter_900Black', color: c.bg.primary },

  row: { backgroundColor: c.bg.card, borderRadius: radius.lg, padding: spacing[3], gap: spacing[2] },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.ui.in },
  name: { flexShrink: 1, fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  sub: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 2 },
  due: { fontFamily: 'Inter_800ExtraBold' },
  check: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: c.accent.green, borderColor: c.accent.green },
  track: { height: 4, borderRadius: 2, backgroundColor: c.ui.in, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },

  section: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  presetsHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[3], paddingVertical: spacing[1] },
  owner: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  quickItem: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, borderStyle: 'dashed' },
  quickLabel: { flex: 1, fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  quickEvery: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
}));
