import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Search, Link2 } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useExpensesStore } from '@/store/expensesStore';
import { expenseMatchesVehicle, attachPatch } from '@/utils/vehicleMatch';
import { normText } from '@/utils/categoryRules';
import { zl } from '@/utils/money';
import { haptic } from '@/utils/haptics';
import type { Vehicle } from '@/types/vehicles';

// "Podepnij płatność" do pojazdu (2026-11-15, user: "w pojazdach daj mi możliwość
// podpięcia jakiejś płatności") — wydatki z ostatnich 120 dni, które jeszcze się do
// tego pojazdu nie liczą; stuknięcie = `Expense.vehicleId` (utils/vehicleMatch.ts).
const DAYS = 120;
const ddmm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

export default function AttachExpenseSheet({ vehicle, mainId, onClose }: { vehicle: Vehicle | null; mainId?: string; onClose: () => void }) {
  const s = makeS();
  const expenses = useExpensesStore((st) => st.expenses);
  const updateExpense = useExpensesStore((st) => st.updateExpense);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    if (!vehicle) return [];
    const from = new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10);
    const nq = normText(q.trim());
    return expenses
      .filter((e) => e.type === 'expense' && e.date >= from && !expenseMatchesVehicle(e, vehicle, mainId))
      .filter((e) => !nq || normText(`${e.storeName ?? ''} ${e.note ?? ''} ${e.amount.toFixed(2).replace('.', ',')}`).includes(nq))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 60);
  }, [vehicle, expenses, q, mainId]);

  return (
    <AppBottomSheet visible={!!vehicle} onClose={onClose} maxHeightRatio={0.85} header={<Text style={s.title}>Podepnij płatność · {vehicle?.name}</Text>}>
      <View style={s.field}>
        <Search size={15} color={colors.text.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Szukaj: sklep, opis, kwota" placeholderTextColor={colors.text.muted} style={s.input} autoCorrect={false} />
      </View>
      <Text style={s.hint}>Ostatnie {DAYS} dni · wydatki, których ten pojazd jeszcze nie liczy</Text>
      {list.length === 0 ? (
        <Text style={s.empty}>{q ? 'Nic nie pasuje.' : 'Brak wydatków do podpięcia.'}</Text>
      ) : list.map((e) => (
        <TouchableOpacity key={e.id} style={s.row} activeOpacity={0.7}
          onPress={() => { haptic.success(); updateExpense(e.id, attachPatch(e, vehicle!.id)); }}>
          <Text style={s.date}>{ddmm(e.date)}</Text>
          <Text style={s.label} numberOfLines={1}>{e.storeName || e.note || 'Wydatek'}</Text>
          <Text style={s.amount}>{zl(e.amount)}</Text>
          <Link2 size={14} color={colors.text.secondary} />
        </TouchableOpacity>
      ))}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary, paddingBottom: spacing[2] },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3] },
  input: { flex: 1, minWidth: 0, paddingVertical: 9, fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  hint: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: spacing[2], marginBottom: spacing[1] },
  empty: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, paddingVertical: spacing[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.ui.line },
  date: { width: 40, fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  label: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  amount: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
}));
