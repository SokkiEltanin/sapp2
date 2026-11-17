import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Pencil, Unlink } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useExpensesStore } from '@/store/expensesStore';
import { useCategoriesVersion } from '@/store/categoriesStore';
import { EXPENSE_CATEGORIES } from '@/utils/expenseCategory';
import { detachPatch, vehicleMatchReason } from '@/utils/vehicleMatch';
import { offerUndo } from '@/services/undo';
import { haptic } from '@/utils/haptics';
import { zl } from '@/utils/money';
import type { Expense } from '@/types/finances';
import type { Vehicle } from '@/types/vehicles';

// Płatność z listy "Wydatki pojazdu" (2026-11-17, user: "kliknąć transakcję i ją edytować
// stamtąd, albo że to nie do tego auta — np. to do transportu albo prezent"). Jedno
// stuknięcie: edycja całego wydatku, odpięcie, przeniesienie do kategorii (od razu
// odpina od pojazdu) albo do innego pojazdu. Każda zmiana z "Cofnij".
export default function VehicleExpenseSheet({ expense, vehicle, vehicles, mainId, onClose, onEdit }: {
  expense: Expense | null;
  vehicle: Vehicle;
  vehicles: Vehicle[];
  mainId?: string;
  onClose: () => void;
  onEdit: (e: Expense) => void;
}) {
  const s = makeS();
  useCategoriesVersion();
  const updateExpense = useExpensesStore((st) => st.updateExpense);
  const e = expense;
  const name = e ? e.storeName || e.note || 'Wydatek' : '';
  const why = e ? vehicleMatchReason(e, vehicle, mainId) : null;
  const before = e ? { vehicleId: e.vehicleId ?? null, vehicleOff: e.vehicleOff ?? [], expenseCategory: e.expenseCategory } : null;

  const apply = (patch: Partial<Expense>, msg: string) => {
    if (!e || !before) return;
    haptic.success();
    updateExpense(e.id, patch);
    offerUndo(msg, () => updateExpense(e.id, before));
    onClose();
  };
  const toCategory = (tag: string, label: string) =>
    apply({ ...detachPatch(e!, vehicle.id), expenseCategory: tag }, `${name} → ${label}`);
  const toVehicle = (v: Vehicle) => {
    const off = [...new Set([...(e!.vehicleOff ?? []), vehicle.id])].filter((x) => x !== v.id);
    apply({ vehicleId: v.id, vehicleOff: off }, `${name} → ${v.name}`);
  };

  const others = vehicles.filter((v) => v.id !== vehicle.id);
  const cats = EXPENSE_CATEGORIES.filter((c) => c.tag !== e?.expenseCategory);

  return (
    <AppBottomSheet visible={!!e} onClose={onClose}
      header={e ? (
        <View style={s.head}>
          <Text style={s.title} numberOfLines={1}>{name}</Text>
          <Text style={s.sub}>
            {zl(e.amount)} · {e.date.slice(8, 10)}.{e.date.slice(5, 7)}.{e.date.slice(2, 4)} · {why === 'manual' ? 'podpięte ręcznie' : why === 'tag' ? `tag #${vehicle.tag}` : 'paliwo (automatycznie)'}
          </Text>
        </View>
      ) : null}>
      {e && (
        <>
          <View style={s.row}>
            <TouchableOpacity style={[s.btn, s.btnMain]} onPress={() => { haptic.tap(); onEdit(e); }} accessibilityLabel="Edytuj wydatek">
              <Pencil size={14} color={colors.bg.primary} />
              <Text style={[s.btnTxt, { color: colors.bg.primary }]}>Edytuj wydatek</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btn} onPress={() => apply(detachPatch(e, vehicle.id), `Odpięto: ${name}`)} accessibilityLabel="Nie do tego pojazdu">
              <Unlink size={14} color={colors.text.secondary} />
              <Text style={s.btnTxt}>Nie do {vehicle.name}</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.label}>To było na… (odepnie od pojazdu)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {cats.map((c) => (
              <TouchableOpacity key={c.tag} style={s.chip} onPress={() => toCategory(c.tag, c.label)}>
                <View style={[s.dot, { backgroundColor: c.color }]} />
                <Text style={s.chipTxt}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {others.length > 0 && (
            <>
              <Text style={s.label}>Inny pojazd</Text>
              <View style={[s.chips, { flexWrap: 'wrap' }]}>
                {others.map((v) => (
                  <TouchableOpacity key={v.id} style={s.chip} onPress={() => toVehicle(v)}>
                    <View style={[s.dot, { backgroundColor: v.color }]} />
                    <Text style={s.chipTxt}>{v.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </>
      )}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  head: { paddingBottom: spacing[2], gap: 2 },
  title: { fontSize: 18, fontFamily: 'Inter_900Black', color: c.text.bright },
  sub: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  row: { flexDirection: 'row', gap: spacing[2] },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[2] },
  btnMain: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  btnTxt: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  label: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[4], marginBottom: spacing[2] },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipTxt: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
}));
