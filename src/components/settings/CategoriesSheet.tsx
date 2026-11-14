import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Plus, Check, Trash2, Eye, RotateCcw } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { SheetCard } from '@/components/design/SheetCard';
import { useCategoriesStore } from '@/store/categoriesStore';
import { useExpensesStore } from '@/store/expensesStore';
import { resolveCategories, categoryUsage, reassignCategory, type CatKind, type ResolvedCat } from '@/utils/categoryRegistry';
import { haptic } from '@/utils/haptics';

// Kategorie (2026-11-14, user: "w ustawieniach edytować nazwy istniejących
// kategorii lub usuwać/dodać — czy nie będzie kolizji danych"). Bez kolizji: dane
// trzymają tag, tu zmienia się tylko nazwa/kolor. Usunięcie: gdy kategoria jest
// użyta, najpierw wybór, dokąd przenieść te pozycje (albo "bez kategorii");
// domyślna kategoria jest wtedy ukrywana (można przywrócić), własna — usuwana.
const SWATCHES = ['#F87171', '#FB923C', '#FBBF24', '#A3E635', '#4ADE80', '#2DD4BF', '#22D3EE', '#60A5FA', '#A78BFA', '#F472B6', '#D6A15E', '#9CA3AF'];

export default function CategoriesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const prefs = useCategoriesStore((st) => st.prefs);
  const { rename, recolor, setHidden, add, removeCustom } = useCategoriesStore.getState();
  const expenses = useExpensesStore((st) => st.expenses);
  const [kind, setKind] = useState<CatKind>('food');
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => { if (visible) { setEditing(null); setDeleting(null); setNewName(''); } }, [visible]);

  const cats = useMemo(() => resolveCategories(prefs, kind), [prefs, kind]);
  const visibleCats = cats.filter((c) => !c.hidden);
  const hiddenCats = cats.filter((c) => c.hidden);
  const usage = useMemo(() => new Map(cats.map((c) => [c.tag, categoryUsage(expenses, kind, c.tag)])), [cats, expenses, kind]);

  const startEdit = (c: ResolvedCat) => { haptic.tap(); setDeleting(null); setEditing(c.tag); setName(c.label); setColor(c.color); };
  const saveEdit = (c: ResolvedCat) => {
    haptic.success();
    if (name.trim() && name.trim() !== c.label) rename(kind, c.tag, name.trim());
    if (color !== c.color) recolor(kind, c.tag, color);
    setEditing(null);
  };
  const finishDelete = (c: ResolvedCat, to: string | undefined | null) => {
    // to === null → tylko ukryj/usuń (brak użyć)
    haptic.success();
    if (to !== null) {
      const { expenses: next, changed } = reassignCategory(useExpensesStore.getState().expenses, kind, c.tag, to);
      if (changed) useExpensesStore.setState({ expenses: next });
    }
    if (c.custom) removeCustom(kind, c.tag); else setHidden(kind, c.tag, true);
    setDeleting(null); setEditing(null);
  };

  return (
    <AppBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.92} header={<Text style={s.title}>Kategorie</Text>}>
      <View style={s.seg}>
        {([['food', 'Jedzenie'], ['fixed', 'Stałe'], ['var', 'Zmienne']] as const).map(([k, label]) => (
          <TouchableOpacity key={k} style={[s.segItem, kind === k && s.segOn]} onPress={() => { haptic.tap(); setKind(k); setEditing(null); setDeleting(null); }}>
            <Text style={[s.segLabel, kind === k && s.segLabelOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.note}>{kind === 'fixed' ? 'Stałe rozpoznają się same z nazwy płatności (prąd, czynsz…) — tu zmienisz nazwę i kolor.' : 'Zmiana nazwy nie rusza danych — wydatki pamiętają kategorię, nie jej nazwę.'}</Text>

      <SheetCard>
        {visibleCats.map((c) => {
          const n = usage.get(c.tag) ?? 0;
          const isEdit = editing === c.tag;
          const isDel = deleting === c.tag;
          return (
            <View key={c.tag} style={s.rowWrap}>
              <TouchableOpacity style={s.row} onPress={() => (isEdit ? setEditing(null) : startEdit(c))} activeOpacity={0.7}>
                <View style={[s.dot, { backgroundColor: c.color }]} />
                <Text style={s.name} numberOfLines={1}>{c.label}</Text>
                {c.defaultLabel && c.defaultLabel !== c.label && <Text style={s.was} numberOfLines={1}>({c.defaultLabel})</Text>}
                <Text style={s.count}>{n > 0 ? `${n}×` : ''}</Text>
              </TouchableOpacity>
              {isEdit && !isDel && (
                <View style={s.edit}>
                  <View style={s.editRow}>
                    <TextInput value={name} onChangeText={setName} style={s.input} placeholder="Nazwa" placeholderTextColor={colors.text.muted} />
                    <TouchableOpacity style={s.okBtn} onPress={() => saveEdit(c)} accessibilityLabel="Zapisz"><Check size={16} color={colors.bg.primary} /></TouchableOpacity>
                    {kind !== 'fixed' && (
                      <TouchableOpacity style={s.delBtn} onPress={() => { haptic.tap(); if (n === 0) finishDelete(c, null); else setDeleting(c.tag); }} accessibilityLabel="Usuń">
                        <Trash2 size={15} color={colors.accent.red} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={s.swatches}>
                    {SWATCHES.map((sw) => (
                      <TouchableOpacity key={sw} onPress={() => { haptic.tap(); setColor(sw); }} style={[s.swatch, { backgroundColor: sw }, color === sw && s.swatchOn]} />
                    ))}
                  </View>
                  {c.defaultLabel && c.defaultLabel !== c.label && (
                    <TouchableOpacity style={s.reset} onPress={() => { haptic.tap(); rename(kind, c.tag, ''); setName(c.defaultLabel!); }}>
                      <RotateCcw size={11} color={colors.text.muted} /><Text style={s.resetLabel}>przywróć nazwę „{c.defaultLabel}”</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {isDel && (
                <View style={s.edit}>
                  <Text style={s.delQ}>„{c.label}” ma {n} {n === 1 ? 'użycie' : 'użyć'}. Przenieś je do:</Text>
                  <View style={s.swatchesWrap}>
                    {visibleCats.filter((o) => o.tag !== c.tag).map((o) => (
                      <TouchableOpacity key={o.tag} style={s.moveChip} onPress={() => finishDelete(c, o.tag)}>
                        <View style={[s.dot, { backgroundColor: o.color }]} /><Text style={s.moveLabel}>{o.label}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={s.moveChip} onPress={() => finishDelete(c, undefined)}>
                      <Text style={s.moveLabel}>bez kategorii</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => setDeleting(null)}><Text style={s.cancel}>anuluj</Text></TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        {kind !== 'fixed' && <View style={[s.editRow, { marginTop: spacing[3] }]}>
          <TextInput value={newName} onChangeText={setNewName} style={s.input} placeholder={kind === 'var' ? 'Nowa, np. Sport' : 'Nowa, np. Kawa'} placeholderTextColor={colors.text.muted} />
          <TouchableOpacity
            style={[s.addBtn, !newName.trim() && { opacity: 0.4 }]}
            disabled={!newName.trim()}
            onPress={() => { haptic.success(); add(kind, newName, SWATCHES[(visibleCats.length + 3) % SWATCHES.length]); setNewName(''); }}
          >
            <Plus size={15} color={colors.bg.primary} /><Text style={s.addLabel}>Dodaj</Text>
          </TouchableOpacity>
        </View>}
      </SheetCard>

      {hiddenCats.length > 0 && (
        <SheetCard title="Ukryte (stare dane dalej je pokazują)">
          {hiddenCats.map((c) => (
            <View key={c.tag} style={s.row}>
              <View style={[s.dot, { backgroundColor: c.color, opacity: 0.5 }]} />
              <Text style={[s.name, { color: colors.text.muted }]}>{c.label}</Text>
              <TouchableOpacity onPress={() => { haptic.tap(); setHidden(kind, c.tag, false); }} hitSlop={8} style={s.restore}>
                <Eye size={14} color={colors.text.secondary} /><Text style={s.resetLabel}>przywróć</Text>
              </TouchableOpacity>
            </View>
          ))}
        </SheetCard>
      )}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary, paddingBottom: spacing[2] },
  seg: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, overflow: 'hidden' },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  segOn: { backgroundColor: c.text.bright },
  segLabel: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  segLabelOn: { color: c.bg.primary },
  note: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[2] },
  rowWrap: { borderBottomWidth: 1, borderBottomColor: c.ui.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 9 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flexShrink: 1, fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  was: { flexShrink: 1, fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  count: { marginLeft: 'auto', fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted },
  edit: { paddingBottom: spacing[3], gap: spacing[2] },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  input: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: 7, fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  okBtn: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.text.bright },
  delBtn: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.accent.red + '55' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatchesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: c.text.bright },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resetLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted },
  delQ: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  moveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  moveLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  cancel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.muted, textDecorationLine: 'underline' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing[3], paddingVertical: 9, borderRadius: radius.md, backgroundColor: c.text.bright },
  addLabel: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.bg.primary },
  restore: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
}));
