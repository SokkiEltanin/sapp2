import { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Search } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import type { Expense } from '@/types/finances';

// Pełna lista transakcji (Faza 2.4, 2026-11-01) — "Ostatnie transakcje" na ekranie
// Finanse pokazuje TYLKO 4 pozycje (ARCHITECTURE.md §FINANSE), to tutaj żyje
// reszta: pełnoekranowy popup z wyszukiwarką, ten sam wzorzec co WydatkiModal/
// ProductsModal. `onSelect` NIE zamyka tego modala (ta sama zasada co fix
// MonthViewModal/DayDetailModal — dwa niezależne Modale mogą być widoczne naraz),
// żeby po zamknięciu edycji user wracał TUTAJ, do listy, nie od razu do głównego
// ekranu Finansów.
export default function TransactionsModal({
  visible, onClose, expenses, onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  expenses: Expense[];
  onSelect: (e: Expense) => void;
}) {
  const s = makeS();
  const [query, setQuery] = useState('');

  const sorted = useMemo(
    () => [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [expenses],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((e) =>
      (e.storeName ?? '').toLowerCase().includes(q)
      || (e.note ?? '').toLowerCase().includes(q)
      || (e.tags ?? []).some((t) => t.toLowerCase().includes(q)));
  }, [sorted, query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Text style={s.title}>Transakcje</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={s.closeBtn}>
            <X size={18} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
        <View style={s.searchRow}>
          <Search size={15} color={colors.text.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Szukaj sklepu, notatki, tagu…"
            placeholderTextColor={colors.text.muted}
            style={s.searchInput}
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={s.empty}>{expenses.length === 0 ? 'Brak transakcji — dodaj pierwszą przyciskiem +.' : 'Brak wyników.'}</Text>
          }
          renderItem={({ item: e }) => (
            <TouchableOpacity style={s.row} onPress={() => onSelect(e)} activeOpacity={0.7}>
              <View style={s.rowInfo}>
                <Text style={s.rowNote} numberOfLines={1}>
                  {e.storeName || e.note || (e.type === 'income' ? 'Przychód' : 'Wydatek')}
                </Text>
                <Text style={s.rowDate}>{e.date}</Text>
              </View>
              <Text style={[s.rowAmount, e.type === 'income' && s.rowAmountIncome]}>
                {e.type === 'income' ? '+' : '−'}{e.amount.toFixed(2)} zł
              </Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  title: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.primary },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginHorizontal: spacing[4], marginBottom: spacing[3],
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.primary },

  list: { paddingHorizontal: spacing[4], paddingBottom: spacing[8] },
  empty: { fontSize: 12.5, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', paddingVertical: spacing[6] },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  rowInfo: { flex: 1, marginRight: spacing[2] },
  rowNote: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  rowDate: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },
  rowAmount: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.text.bright },
  rowAmountIncome: { color: c.accent.green },
}));
