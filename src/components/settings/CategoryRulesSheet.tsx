import { removeWithUndo } from '@/services/undo';
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Plus, Trash2, ArrowRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { SheetCard } from '@/components/design/SheetCard';
import { useCategoryRulesStore } from '@/store/categoryRulesStore';
import { useCategoriesStore } from '@/store/categoriesStore';
import { useExpensesStore } from '@/store/expensesStore';
import { resolveCategories } from '@/utils/categoryRegistry';
import { applyRulesToAll, ruleImpact } from '@/utils/categoryRules';
import type { CategoryRule, RuleField } from '@/types/categoryRules';
import { haptic } from '@/utils/haptics';
import { nWydatkow } from '@/utils/plural';

// Reguły kategoryzacji (2026-11-14): "jeśli sklep/opis albo pozycja zawiera X →
// kategoria Y". Działają przy każdym nowym wydatku i — przy dodaniu reguły — od razu
// uzupełniają historię. Tylko puste kategorie; ręcznie ustawione zostają.
// Reguła „przelew własny” (2026-11-18) — nie kategoria, tylko oznaczenie (fvOverride 'transfer').
const OWN_CAT = { tag: 'transfer', label: 'Przelew własny', color: '#9CA3AF' };

export default function CategoryRulesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const rules = useCategoryRulesStore((st) => st.rules);
  const prefs = useCategoriesStore((st) => st.prefs);
  const expenses = useExpensesStore((st) => st.expenses);
  const [field, setField] = useState<RuleField>('store');
  const [match, setMatch] = useState('');
  const [target, setTarget] = useState<{ kind: 'food' | 'var' | 'own'; tag: string } | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => { if (visible) { setMatch(''); setTarget(null); setInfo(null); } }, [visible]);

  const foodCats = useMemo(() => resolveCategories(prefs, 'food').filter((c) => !c.hidden), [prefs]);
  const varCats = useMemo(() => resolveCategories(prefs, 'var').filter((c) => !c.hidden), [prefs]);
  const labelOf = (r: Pick<CategoryRule, 'kind' | 'tag'>) =>
    r.kind === 'own' ? OWN_CAT : (r.kind === 'food' ? foodCats : varCats).find((c) => c.tag === r.tag) ?? { label: r.tag, color: colors.text.muted };

  const draft: CategoryRule | null = match.trim().length >= 2 && target
    ? { id: 'draft', field, match: match.trim(), kind: target.kind, tag: target.tag, createdAt: '', updatedAt: '' } : null;
  const impact = useMemo(() => (draft ? ruleImpact(expenses, draft) : 0), [expenses, draft?.field, draft?.match, draft?.kind, draft?.tag]);

  const addRule = () => {
    if (!draft) return;
    haptic.success();
    const rule = useCategoryRulesStore.getState().add({ field, match: draft.match, kind: draft.kind, tag: draft.tag });
    const { expenses: next, changed } = applyRulesToAll(useExpensesStore.getState().expenses, [rule], new Date().toISOString());
    if (changed) useExpensesStore.setState({ expenses: next });
    setInfo(changed ? `Uzupełniono ${nWydatkow(changed)}.` : 'Zadziała przy kolejnych wydatkach.');
    setMatch(''); setTarget(null);
  };

  const pickField = (f: RuleField) => {
    haptic.tap(); setField(f);
    if (f === 'store' && target?.kind === 'food') setTarget(null);
    if (f === 'item' && target?.kind === 'own') setTarget(null);
  };

  const chip = (kind: 'food' | 'var' | 'own', c: { tag: string; label: string; color: string }) => {
    const on = target?.kind === kind && target.tag === c.tag;
    return (
      <TouchableOpacity key={c.tag} style={[s.chip, on && { borderColor: c.color, backgroundColor: c.color + '22' }]} onPress={() => { haptic.tap(); setTarget(on ? null : { kind, tag: c.tag }); }}>
        <View style={[s.dot, { backgroundColor: c.color }]} />
        <Text style={[s.chipLabel, on && s.chipLabelOn]}>{c.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <AppBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.92} header={<Text style={s.title}>Reguły kategorii</Text>}>
      <Text style={s.intro}>Gdy sklep albo pozycja paragonu zawiera dany tekst, appka sama wpisze kategorię. Tylko tam, gdzie jej brak — Twoje ręczne wybory zostają.</Text>

      <SheetCard title="Nowa reguła">
        <View style={s.seg}>
          {([['store', 'Sklep / opis'], ['item', 'Pozycja paragonu']] as const).map(([k, label]) => (
            <TouchableOpacity key={k} style={[s.segItem, field === k && s.segOn]} onPress={() => pickField(k)}>
              <Text style={[s.segLabel, field === k && s.segLabelOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput value={match} onChangeText={setMatch} style={s.input} autoCapitalize="none"
          placeholder={field === 'store' ? 'zawiera, np. apteka, orlen, rossmann' : 'zawiera, np. kabel, czekolada, olej'} placeholderTextColor={colors.text.muted} />
        {field === 'item' && <Text style={s.group}>Jedzenie</Text>}
        {/* Poziomy scroll (2026-11-16, user: "listy powinny być poziome scroll"). */}
        {field === 'item' && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">{foodCats.map((c) => chip('food', c))}</ScrollView>}
        <Text style={s.group}>{field === 'item' ? 'Nie jedzenie' : 'Kategoria Zmiennych'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">{field === 'store' && chip('own', OWN_CAT)}{varCats.map((c) => chip('var', c))}</ScrollView>
        <TouchableOpacity style={[s.addBtn, !draft && s.addOff]} disabled={!draft} onPress={addRule}>
          <Plus size={15} color={colors.bg.primary} />
          <Text style={s.addLabel}>{!draft ? 'Wpisz tekst i wybierz kategorię' : impact > 0 ? `Dodaj · uzupełni ${impact}` : 'Dodaj regułę'}</Text>
        </TouchableOpacity>
        {info && <Text style={s.info}>{info}</Text>}
      </SheetCard>

      <SheetCard title={`Twoje reguły · ${rules.length}`}>
        {rules.length === 0 ? <Text style={s.empty}>Brak — dodaj pierwszą wyżej.</Text> : [...rules].sort((a, b) => a.match.localeCompare(b.match)).map((r) => {
          const c = labelOf(r);
          return (
            <View key={r.id} style={s.row}>
              <Text style={s.field}>{r.field === 'store' ? 'sklep' : 'pozycja'}</Text>
              <Text style={s.match} numberOfLines={1}>„{r.match}”</Text>
              <ArrowRight size={13} color={colors.text.muted} />
              <View style={[s.dot, { backgroundColor: c.color }]} />
              <Text style={s.target} numberOfLines={1}>{c.label}</Text>
              <TouchableOpacity style={s.del} hitSlop={8} accessibilityLabel="Usuń regułę" onPress={() => { haptic.tap(); removeWithUndo(useCategoryRulesStore, 'rules', r, `Usunięto regułę „${r.match}”`); }}>
                <Trash2 size={14} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
          );
        })}
        {rules.length > 0 && <Text style={s.note}>Usunięcie reguły nie zmienia już uzupełnionych wydatków.</Text>}
      </SheetCard>
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary, paddingBottom: spacing[2] },
  intro: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, lineHeight: 18 },
  seg: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, overflow: 'hidden', marginBottom: spacing[2] },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  segOn: { backgroundColor: c.text.bright },
  segLabel: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  segLabelOn: { color: c.bg.primary },
  input: { minWidth: 0, borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: 8, fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  group: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing[3], marginBottom: 6 },
  chipScroll: { flexGrow: 0 },
  chips: { flexDirection: 'row', gap: 6, paddingRight: spacing[2] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  chipLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  chipLabelOn: { color: c.text.primary },
  dot: { width: 9, height: 9, borderRadius: 5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: spacing[3], paddingVertical: 10, borderRadius: radius.md, backgroundColor: c.text.bright },
  addOff: { opacity: 0.35 },
  addLabel: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.bg.primary },
  info: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.accent.green, marginTop: spacing[2], textAlign: 'center' },
  empty: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.ui.line },
  field: { fontSize: 9.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', width: 52 },
  match: { flexShrink: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  target: { flexShrink: 1, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  del: { marginLeft: 'auto', padding: 4 },
  note: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: spacing[2] },
}));
