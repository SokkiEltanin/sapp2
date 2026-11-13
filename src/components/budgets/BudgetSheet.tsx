import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Trash2, Check } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import NumberInput from '@/components/design/NumberInput';
import { SheetCard } from '@/components/design/SheetCard';
import { useBudgetsStore } from '@/store/budgetsStore';
import { useExpensesStore } from '@/store/expensesStore';
import type { BudgetScope } from '@/types/budgets';
import { budgetStatuses, budgetHistory, suggestLimit, scopeLabel, scopeColor, type BudgetStatus } from '@/utils/budgets';
import { EXPENSE_CATEGORIES } from '@/utils/expenseCategory';
import { haptic } from '@/utils/haptics';

// Budżety (2026-11-13): każdy limit w osobnej karcie — wydane / limit, pasek z
// kreską "dziś" (ile miesiąca minęło), zostało i ile dziennie, prognoza, 6
// ostatnich miesięcy (zmieszczone / ponad). Limit zmieniany w miejscu. Na dole
// dodanie nowego: zakres + podpowiedź limitu ze średniej 3 miesięcy.
const ALL_SCOPES: BudgetScope[] = ['all', 'food', 'variable', 'fixed', ...EXPENSE_CATEGORIES.map((c) => `cat:${c.tag}` as BudgetScope)];
const zl = (n: number) => `${Math.round(n).toLocaleString('pl-PL')} zł`;

export function levelColor(s: BudgetStatus): string {
  return s.level === 'over' ? colors.accent.red : s.level === 'warn' ? colors.accent.orange : s.level === 'pace' ? colors.accent.orange : colors.text.secondary;
}

export function BudgetBar({ s, height = 6 }: { s: BudgetStatus; height?: number }) {
  const st = makeS();
  return (
    <View style={[st.track, { height, borderRadius: height / 2 }]}>
      <View style={[st.fill, { width: `${Math.min(100, s.pct * 100)}%`, backgroundColor: levelColor(s), borderRadius: height / 2 }]} />
      <View style={[st.paceMark, { left: `${Math.min(100, s.pacePct * 100)}%` }]} />
    </View>
  );
}

export function budgetLine(s: BudgetStatus): string {
  if (s.left < 0) return `${zl(-s.left)} ponad limit`;
  const base = `zostało ${zl(s.left)} · ${s.perDay} zł/dzień`;
  return s.level === 'pace' ? `${base} · tempo ~${zl(s.projected)}` : base;
}

export default function BudgetSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const budgets = useBudgetsStore((st) => st.budgets);
  const setBudget = useBudgetsStore((st) => st.setBudget);
  const remove = useBudgetsStore((st) => st.remove);
  const expenses = useExpensesStore((st) => st.expenses);
  const statuses = useMemo(() => budgetStatuses(budgets, expenses), [budgets, expenses]);
  const free = ALL_SCOPES.filter((sc) => !budgets.some((b) => b.scope === sc));

  const [newScope, setNewScope] = useState<BudgetScope | null>(null);
  const [newLimit, setNewLimit] = useState<number | undefined>(undefined);
  const [edits, setEdits] = useState<Record<string, number | undefined>>({});
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const suggestion = useMemo(() => (newScope ? suggestLimit(expenses, newScope) : null), [newScope, expenses]);

  useEffect(() => { if (visible) { setNewScope(null); setNewLimit(undefined); setEdits({}); setConfirmDel(null); } }, [visible]);

  const pickScope = (sc: BudgetScope) => {
    haptic.tap();
    setNewScope(sc);
    setNewLimit(suggestLimit(expenses, sc) ?? undefined);
  };
  const addNew = () => {
    if (!newScope || !newLimit || newLimit <= 0) return;
    haptic.success();
    setBudget(newScope, Math.round(newLimit));
    setNewScope(null); setNewLimit(undefined);
  };

  return (
    <AppBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.9} header={<Text style={s.title}>Budżety</Text>}>
      {statuses.length === 0 && <Text style={s.intro}>Miesięczny limit na jedzenie, zmienne albo kategorię — appka pokaże, ile zostało na dzień, i ostrzeże przy 80% i 100%.</Text>}

      {statuses.map((st) => {
        const b = st.budget;
        const hist = budgetHistory(b, expenses, 6);
        const withinN = hist.filter((h) => h.spent > 0 && h.within).length;
        const knownN = hist.filter((h) => h.spent > 0).length;
        const maxH = Math.max(b.limit, ...hist.map((h) => h.spent), 1);
        const edit = edits[b.id];
        const dirty = edit != null && edit > 0 && Math.round(edit) !== b.limit;
        const dot = scopeColor(b.scope);
        return (
          <SheetCard key={b.id} style={statuses[0] === st ? { marginTop: 0 } : undefined}>
            <View style={s.headRow}>
              {dot && <View style={[s.dot, { backgroundColor: dot }]} />}
              <Text style={s.name}>{scopeLabel(b.scope)}</Text>
              <Text style={[s.amount, { color: levelColor(st) }]}>{zl(st.spent)}</Text>
              <Text style={s.of}> / {zl(b.limit)}</Text>
            </View>
            <BudgetBar s={st} height={8} />
            <Text style={[s.line, st.left < 0 && { color: colors.accent.red }]}>{budgetLine(st)}</Text>

            {knownN > 0 && (
              <>
                <View style={s.hist}>
                  {hist.map((h) => (
                    <View key={h.key} style={s.histCol}>
                      <View style={s.histBox}>
                        <View style={[s.histLimit, { bottom: `${(b.limit / maxH) * 100}%` }]} />
                        {h.spent > 0
                          ? <View style={[s.histBar, { height: `${(h.spent / maxH) * 100}%`, backgroundColor: h.within ? colors.text.secondary : colors.accent.red }]} />
                          : <View style={s.histNone} />}
                      </View>
                      <Text style={s.histLabel}>{h.label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={s.note}>W limicie {withinN} z {knownN} mies. · kreska = limit, czerwone = ponad.</Text>
              </>
            )}

            <View style={s.editRow}>
              <Text style={s.editLabel}>Limit</Text>
              <NumberInput value={edit ?? b.limit} onChangeValue={(v) => setEdits((e) => ({ ...e, [b.id]: v }))} style={s.input} selectTextOnFocus />
              <Text style={s.editLabel}>zł</Text>
              {dirty && (
                <TouchableOpacity style={s.okBtn} onPress={() => { haptic.success(); setBudget(b.scope, Math.round(edit!)); setEdits((e) => ({ ...e, [b.id]: undefined })); }} accessibilityLabel="Zapisz limit">
                  <Check size={16} color={colors.bg.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.delBtn, confirmDel === b.id && s.delBtnOn]}
                onPress={() => { haptic.tap(); if (confirmDel !== b.id) { setConfirmDel(b.id); return; } remove(b.id); setConfirmDel(null); }}
                accessibilityLabel="Usuń budżet"
              >
                <Trash2 size={14} color={confirmDel === b.id ? colors.bg.primary : colors.accent.red} />
              </TouchableOpacity>
            </View>
          </SheetCard>
        );
      })}

      {free.length > 0 && (
        <SheetCard title="Nowy budżet">
          <View style={s.chips}>
            {free.map((sc) => {
              const on = newScope === sc;
              const dot = scopeColor(sc);
              return (
                <TouchableOpacity key={sc} style={[s.chip, on && s.chipOn]} onPress={() => pickScope(sc)} activeOpacity={0.8}>
                  {dot && <View style={[s.dot, { backgroundColor: dot }]} />}
                  <Text style={[s.chipLabel, on && s.chipLabelOn]}>{scopeLabel(sc)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {newScope && (
            <>
              <View style={[s.editRow, { marginTop: spacing[3] }]}>
                <Text style={s.editLabel}>Limit</Text>
                <NumberInput value={newLimit} onChangeValue={setNewLimit} style={s.input} placeholder="np. 1200" placeholderTextColor={colors.text.muted} />
                <Text style={s.editLabel}>zł / mies.</Text>
                <TouchableOpacity style={[s.addBtn, !(newLimit && newLimit > 0) && { opacity: 0.4 }]} onPress={addNew} disabled={!(newLimit && newLimit > 0)}>
                  <Text style={s.addLabel}>Dodaj</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.note}>{suggestion ? `Średnio ${zl(suggestion)} w ostatnich miesiącach (zaokrąglone).` : 'Brak wydatków z ostatnich 3 miesięcy w tym zakresie.'}</Text>
            </>
          )}
        </SheetCard>
      )}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary, paddingBottom: spacing[2] },
  intro: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, lineHeight: 18, marginBottom: spacing[2] },
  headRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: spacing[2] },
  dot: { width: 8, height: 8, borderRadius: 4, alignSelf: 'center' },
  name: { flex: 1, fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  amount: { fontSize: 15, fontFamily: 'Inter_900Black', fontVariant: ['tabular-nums'] },
  of: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted, fontVariant: ['tabular-nums'] },
  line: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary, marginTop: spacing[2] },
  track: { backgroundColor: c.bg.primary, overflow: 'visible', position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  paceMark: { position: 'absolute', top: -3, bottom: -3, width: 2, marginLeft: -1, backgroundColor: c.text.muted, borderRadius: 1 },
  hist: { flexDirection: 'row', gap: 6, height: 56, marginTop: spacing[3] },
  histCol: { flex: 1, alignItems: 'center', gap: 3 },
  histBox: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  histLimit: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: c.text.muted, opacity: 0.6 },
  histBar: { width: '64%', borderRadius: 3, minHeight: 3 },
  histNone: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.border.default },
  histLabel: { fontSize: 9.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  note: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[2], lineHeight: 15 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[3] },
  editLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted },
  input: { flex: 1, borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: 7, fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  okBtn: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.text.bright },
  delBtn: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.accent.red + '55' },
  delBtnOn: { backgroundColor: c.accent.red, borderColor: c.accent.red },
  addBtn: { paddingHorizontal: spacing[3], paddingVertical: 9, borderRadius: radius.md, backgroundColor: c.text.bright },
  addLabel: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.bg.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  chipOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  chipLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  chipLabelOn: { color: c.bg.primary },
}));
