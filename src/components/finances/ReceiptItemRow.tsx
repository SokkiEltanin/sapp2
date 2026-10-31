import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Square, CheckSquare, Trash2, Tag as TagIcon } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import type { ReceiptItem } from '@/types/finances';
import { FOOD_SUBCATS, FOOD_SUBCAT_META } from '@/utils/food';

// Wiersz pozycji paragonu — współdzielony przez tryb "wklej paragon" (sparsowane
// pozycje, część z nich `suspect` po `receiptParser.ts`) i "dodaj ręcznie" (świeże,
// puste pozycje). Checkbox z LEWEJ = "licz się do sumy" (odznaczony domyślnie dla
// `suspect` — parser podejrzewa nagłówek/sumę, nie realny produkt), kosz z PRAWEJ —
// ten sam układ co TaskRow (kosz/checkbox po przeciwnych stronach), żeby cała appka
// czytała się tym samym językiem gestów.
export default function ReceiptItemRow({
  item,
  onChange,
  onDelete,
}: {
  item: ReceiptItem;
  onChange: (patch: Partial<ReceiptItem>) => void;
  onDelete: () => void;
}) {
  const s = makeS();
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [discountInput, setDiscountInput] = useState<string | null>(null);

  const included = !item.excluded;
  const meta = item.foodSubcat ? FOOD_SUBCAT_META[item.foodSubcat] : undefined;

  const setNum = (field: 'quantity' | 'unitPrice' | 'price', raw: string) => {
    const n = parseFloat(raw.replace(',', '.'));
    const v = isNaN(n) ? 0 : n;
    if (field === 'price') { onChange({ price: v }); return; }
    const quantity = field === 'quantity' ? v : item.quantity;
    const unitPrice = field === 'unitPrice' ? v : item.unitPrice;
    onChange({ quantity, unitPrice, price: Math.round(quantity * unitPrice * 100) / 100 });
  };

  const submitDiscount = () => {
    const n = parseFloat((discountInput ?? '').replace(',', '.'));
    if (!isNaN(n) && n > 0) {
      onChange({ discount: Math.round(((item.discount ?? 0) + n) * 100) / 100, price: Math.max(0, Math.round((item.price - n) * 100) / 100) });
    }
    setDiscountInput(null);
  };

  return (
    <View style={[s.row, item.kind === 'deposit' && s.rowDeposit, !included && s.rowExcluded]}>
      <View style={s.topLine}>
        <TouchableOpacity onPress={() => onChange({ excluded: included })} hitSlop={8}>
          {included
            ? <CheckSquare size={18} color={colors.text.bright} />
            : <Square size={18} color={colors.text.muted} />}
        </TouchableOpacity>
        <TextInput
          value={item.name}
          onChangeText={(name) => onChange({ name })}
          style={[s.nameInput, !included && s.textMuted]}
          placeholder="Nazwa produktu"
          placeholderTextColor={colors.text.muted}
        />
        <TouchableOpacity onPress={onDelete} hitSlop={8}>
          <Trash2 size={16} color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      <View style={s.numLine}>
        <TextInput
          value={String(item.quantity)}
          onChangeText={(v) => setNum('quantity', v)}
          keyboardType="decimal-pad"
          style={s.numInput}
        />
        <Text style={s.numSep}>×</Text>
        <TextInput
          value={String(item.unitPrice)}
          onChangeText={(v) => setNum('unitPrice', v)}
          keyboardType="decimal-pad"
          style={s.numInput}
        />
        <Text style={s.numSep}>=</Text>
        <TextInput
          value={String(item.price)}
          onChangeText={(v) => setNum('price', v)}
          keyboardType="decimal-pad"
          style={[s.numInput, s.priceInput]}
        />
        <Text style={s.currency}>zł</Text>
      </View>

      <View style={s.metaLine}>
        {item.kind !== 'deposit' && (
          <TouchableOpacity style={s.tagChip} onPress={() => setTagPickerOpen((v) => !v)} activeOpacity={0.7}>
            <TagIcon size={10} color={meta?.color ?? colors.text.muted} />
            <Text style={[s.tagChipLabel, meta && { color: meta.color }]}>{meta?.label ?? 'Nie-jedzenie'}</Text>
          </TouchableOpacity>
        )}
        {item.promotion && <Text style={s.promoBadge}>{item.promotion}</Text>}
        {discountInput === null ? (
          item.kind !== 'deposit' && (
            <TouchableOpacity onPress={() => setDiscountInput('')}>
              <Text style={s.addDiscountLabel}>+ zniżka</Text>
            </TouchableOpacity>
          )
        ) : (
          <View style={s.discountRow}>
            <TextInput
              value={discountInput}
              onChangeText={setDiscountInput}
              keyboardType="decimal-pad"
              placeholder="zł"
              placeholderTextColor={colors.text.muted}
              style={s.discountInput}
              autoFocus
              onSubmitEditing={submitDiscount}
              onBlur={submitDiscount}
            />
          </View>
        )}
      </View>

      {tagPickerOpen && item.kind !== 'deposit' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pickerScroll}>
          <TouchableOpacity
            style={[s.pickerChip, !item.foodSubcat && s.pickerChipActive]}
            onPress={() => { onChange({ foodSubcat: undefined }); setTagPickerOpen(false); }}
          >
            <Text style={s.pickerChipLabel}>Brak</Text>
          </TouchableOpacity>
          {FOOD_SUBCATS.map((sc) => (
            <TouchableOpacity
              key={sc.tag}
              style={[s.pickerChip, item.foodSubcat === sc.tag && { backgroundColor: sc.color }]}
              onPress={() => { onChange({ foodSubcat: sc.tag }); setTagPickerOpen(false); }}
            >
              <Text style={[s.pickerChipLabel, item.foodSubcat === sc.tag && s.pickerChipLabelActive]}>{sc.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  row: {
    backgroundColor: c.bg.elevated, borderRadius: radius.md, padding: spacing[2],
    gap: spacing[1], marginBottom: spacing[2],
  },
  rowDeposit: { opacity: 0.75 },
  rowExcluded: { opacity: 0.45 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  nameInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary, paddingVertical: 2 },
  textMuted: { color: c.text.muted, textDecorationLine: 'line-through' },
  numLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingLeft: spacing[5] },
  numInput: {
    fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.secondary,
    backgroundColor: c.bg.card, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 4,
    minWidth: 44, textAlign: 'center',
  },
  priceInput: { fontFamily: 'Inter_900Black', color: c.text.bright, minWidth: 56 },
  numSep: { fontSize: 12, color: c.text.muted },
  currency: { fontSize: 11, color: c.text.muted },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingLeft: spacing[5], flexWrap: 'wrap' },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.bg.card, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 3,
  },
  tagChipLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  promoBadge: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.accent.green },
  addDiscountLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted },
  discountRow: { flexDirection: 'row', alignItems: 'center' },
  discountInput: {
    fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.primary,
    backgroundColor: c.bg.card, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 3, minWidth: 48,
  },
  pickerScroll: { marginTop: 2, paddingLeft: spacing[5] },
  pickerChip: {
    backgroundColor: c.bg.card, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 5,
    marginRight: spacing[1],
  },
  pickerChipActive: { backgroundColor: c.text.bright },
  pickerChipLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  pickerChipLabelActive: { color: c.bg.primary },
}));
