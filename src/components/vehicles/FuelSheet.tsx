import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Fuel, Check } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { logFuelFillUp, logFuelForExistingExpense } from '@/services/vehicleFuelLog';
import { currentOdometer } from '@/utils/vehicleMatch';
import { FUEL_TYPE_LABEL, type FuelType, type Vehicle } from '@/types/vehicles';
import { haptic } from '@/utils/haptics';
import { todayISO, ymd } from '@/utils/date';

// Formularz tankowania jako sheet (2026-11-12, CLAUDE.md zasada 10 — wcześniej
// rozwijany na stałe w karcie ekranu Pojazdy). Dwa tryby:
// - nowe tankowanie → `logFuelFillUp` (tworzy wydatek),
// - `prefill.expenseId` → uzupełnia JUŻ ISTNIEJĄCY wydatek (np. Orlen z banku)
//   o litry/przebieg, bez drugiego wydatku (`logFuelForExistingExpense`).
const ALL_FUELS: FuelType[] = ['benzyna', 'diesel', 'lpg', 'elektryczny'];

export interface FuelPrefill { expenseId?: string; amount?: number; date?: string; label?: string }

const num = (s: string) => parseFloat(s.replace(',', '.'));

export default function FuelSheet({ vehicle, prefill, onClose, onSaved }: {
  vehicle: Vehicle | null;
  prefill?: FuelPrefill | null;
  onClose: () => void;
  onSaved?: () => void; // np. AddExpenseModal zamyka się, żeby jego stan nie nadpisał tagów/kwoty
}) {
  const s = makeS();
  const kmRef = useRef<TextInput>(null);
  const [km, setKm] = useState('');
  const [liters, setLiters] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [fuelType, setFuelType] = useState<FuelType | null>(null);

  useEffect(() => {
    if (!vehicle) return;
    setKm(''); setLiters('');
    setAmount(prefill?.amount ? String(prefill.amount).replace('.', ',') : '');
    setDate(prefill?.date?.slice(0, 10) ?? todayISO());
    // Domyślnie paliwo z OSTATNIEGO tankowania (auto na LPG+benzynie tankuje
    // zwykle LPG) — dopiero bez historii pierwsze z "co pije".
    const lastFill = [...vehicle.fuelLog].sort((a, b) => b.date.localeCompare(a.date) || b.odometerKm - a.odometerKm)[0];
    setFuelType(lastFill?.fuelType ?? vehicle.fuelTypes?.[0] ?? null);
  }, [vehicle, prefill]);

  const fuelOptions = vehicle?.fuelTypes?.length ? vehicle.fuelTypes : ALL_FUELS;
  const effFuel = fuelType ?? fuelOptions[0];
  const odometer = vehicle ? currentOdometer(vehicle) : null;
  const kmV = num(km), lV = num(liters), aV = num(amount);
  const canSave = !!vehicle && kmV > 0 && lV > 0 && aV > 0;

  // Podgląd na żywo: cena litra + spalanie od poprzedniego tankowania tego paliwa.
  const preview = useMemo(() => {
    if (!vehicle) return null;
    const price = lV > 0 && aV > 0 ? aV / lV : null;
    const prev = [...vehicle.fuelLog].filter((f) => f.fuelType === effFuel && f.odometerKm < kmV).sort((a, b) => b.odometerKm - a.odometerKm)[0];
    const dist = prev && kmV > prev.odometerKm ? kmV - prev.odometerKm : null;
    const cons = dist && lV > 0 ? (lV / dist) * 100 : null;
    return { price, dist, cons };
  }, [vehicle, effFuel, kmV, lV, aV]);

  const save = () => {
    if (!vehicle || !canSave) return;
    haptic.success();
    const input = { date, odometerKm: kmV, fuelType: effFuel, liters: lV, amount: aV };
    if (prefill?.expenseId) logFuelForExistingExpense(vehicle.id, prefill.expenseId, input);
    else logFuelFillUp(vehicle.id, input);
    onClose();
    onSaved?.();
  };

  const openPicker = () => {
    haptic.tap();
    DateTimePickerAndroid.open({
      value: new Date(`${date}T12:00:00`), mode: 'date',
      onChange: (ev, sel) => { if (ev.type === 'set' && sel) setDate(ymd(sel)); },
    });
  };

  const footer = (
    <TouchableOpacity style={[s.saveBtn, !canSave && { opacity: 0.4 }]} onPress={save} disabled={!canSave} activeOpacity={0.8}>
      <Check size={16} color={colors.bg.primary} />
      <Text style={s.saveLabel}>{prefill?.expenseId ? 'Uzupełnij tankowanie' : 'Zapisz tankowanie'}</Text>
    </TouchableOpacity>
  );

  return (
    <AppBottomSheet visible={!!vehicle} onClose={onClose} footer={footer} initialFocusRef={kmRef}>
      <View style={s.head}>
        <Fuel size={16} color={colors.text.secondary} />
        <Text style={s.title} numberOfLines={1}>Tankowanie · {vehicle?.name}</Text>
      </View>
      {prefill?.label ? <Text style={s.sub} numberOfLines={1}>{prefill.label}</Text> : null}

      <View style={s.grid}>
        <View style={s.cell}>
          <Text style={s.label}>Przebieg</Text>
          <TextInput ref={kmRef} value={km} onChangeText={setKm} style={s.input} keyboardType="decimal-pad" placeholder={odometer != null ? String(odometer) : 'km'} placeholderTextColor={colors.text.muted} />
        </View>
        <View style={s.cell}>
          <Text style={s.label}>Litry</Text>
          <TextInput value={liters} onChangeText={setLiters} style={s.input} keyboardType="decimal-pad" placeholder="38,5" placeholderTextColor={colors.text.muted} />
        </View>
        <View style={s.cell}>
          <Text style={s.label}>Kwota zł</Text>
          <TextInput value={amount} onChangeText={setAmount} style={s.input} keyboardType="decimal-pad" placeholder="210" placeholderTextColor={colors.text.muted} />
        </View>
      </View>
      {odometer != null && kmV > 0 && kmV < odometer && (
        <Text style={s.warn}>Mniej niż ostatni odczyt ({odometer.toLocaleString('pl-PL')} km) — literówka?</Text>
      )}

      {fuelOptions.length > 1 && (
        <View style={s.chips}>
          {fuelOptions.map((f) => (
            <TouchableOpacity key={f} style={[s.chip, effFuel === f && s.chipOn]} onPress={() => { haptic.tap(); setFuelType(f); }} activeOpacity={0.8}>
              <Text style={[s.chipLabel, effFuel === f && s.chipLabelOn]}>{FUEL_TYPE_LABEL[f]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.chips}>
        {[{ l: 'Dziś', v: todayISO() }, { l: 'Wczoraj', v: ymd(new Date(Date.now() - 86400000)) }].map((o) => (
          <TouchableOpacity key={o.l} style={[s.chip, date === o.v && s.chipOn]} onPress={() => { haptic.tap(); setDate(o.v); }} activeOpacity={0.8}>
            <Text style={[s.chipLabel, date === o.v && s.chipLabelOn]}>{o.l}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[s.chip, date !== todayISO() && date !== ymd(new Date(Date.now() - 86400000)) && s.chipOn]} onPress={openPicker} activeOpacity={0.8}>
          <Text style={[s.chipLabel, date !== todayISO() && date !== ymd(new Date(Date.now() - 86400000)) && s.chipLabelOn]}>{date.split('-').reverse().join('.')}</Text>
        </TouchableOpacity>
      </View>

      {preview && (preview.price != null || preview.cons != null) && (
        <Text style={s.preview}>
          {preview.price != null ? `${preview.price.toFixed(2).replace('.', ',')} zł/l` : ''}
          {preview.price != null && preview.cons != null ? ' · ' : ''}
          {preview.cons != null ? `${preview.dist} km od ostatniego → ${preview.cons.toFixed(1).replace('.', ',')} l/100 km` : ''}
        </Text>
      )}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  sub: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 4 },
  grid: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  cell: { flex: 1 },
  label: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    marginTop: 6, borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: 15, fontFamily: 'Inter_800ExtraBold', color: c.text.primary,
  },
  warn: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.accent.red, marginTop: spacing[1] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  chip: { paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  chipOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  chipLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  chipLabelOn: { color: c.bg.primary },
  preview: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.accent.green, marginTop: spacing[3] },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.text.bright, borderRadius: radius.md, paddingVertical: spacing[3] },
  saveLabel: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },
}));
