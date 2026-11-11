import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { ChevronLeft, Plus, Fuel, Gauge, Wrench, Trash2, Star } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useExpensesStore } from '@/store/expensesStore';
import { logFuelFillUp, deleteFuelLogEntry } from '@/services/vehicleFuelLog';
import {
  mainCarId, summarizeVehicle, vehicleYearSummary, costPerKm, currentOdometer,
  avgFuelConsumption, maintenancePresets, maintenanceDueMonths, maintenanceDueLabel,
} from '@/utils/vehicleMatch';
import { FUEL_TYPE_LABEL, VEHICLE_KIND_LABEL, vehicleHasFuel, type VehicleKind, type FuelType } from '@/types/vehicles';
import { haptic } from '@/utils/haptics';
import { todayISO, ymd } from '@/utils/date';

// Ekran "Pojazdy" (2026-11-09, user: "zależy mi na monitoringu jak w sapp tylko
// lepszym... aktualny przebieg, cena i ilość litrów czy LPG czy benzyna [kreator
// pojazdu co pije]... rower... części... tag") — satelicki ekran (ten sam wzorzec
// co app/work.tsx: SafeAreaView+ręczny header, jeden scroll zamiast sapp's
// pełnoekranowego app/vehicles.tsx). Pełny opis portu/ulepszeń (bogaty FuelLog
// zamiast sapp's osobnego OdometerReading, zero Expense.vehicleId) w
// src/types/vehicles.ts/src/utils/vehicleMatch.ts.
//
// "Kreator" = progresywne ujawnianie pól w TYM SAMYM formularzu wg wybranego
// `kind` (sekcja paliwa znika całkiem dla roweru), nie osobny wielostronicowy
// wizard — ten sam wzorzec co AddExpenseModal (pozycje paragonu odkrywają pole
// Kwota tylko gdy puste).

const KIND_OPTIONS: VehicleKind[] = ['car', 'motorcycle', 'scooter', 'bike', 'other'];
const FUEL_OPTIONS: FuelType[] = ['benzyna', 'diesel', 'lpg', 'elektryczny'];
const SWATCHES = [colors.accent.blue, colors.accent.orange, colors.accent.green, colors.accent.red, colors.accent.purple, colors.text.bright];

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
    .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ż/g, 'z').replace(/ź/g, 'z')
    .replace(/[^a-z0-9]+/g, '').slice(0, 20);
}

export default function VehiclesScreen() {
  const s = makeS();
  const vehicles = useVehiclesStore((st) => st.vehicles);
  const addVehicle = useVehiclesStore((st) => st.addVehicle);
  const updateVehicle = useVehiclesStore((st) => st.updateVehicle);
  const deleteVehicle = useVehiclesStore((st) => st.deleteVehicle);
  const setMainCar = useVehiclesStore((st) => st.setMainCar);
  const addMaintenance = useVehiclesStore((st) => st.addMaintenance);
  const deleteMaintenance = useVehiclesStore((st) => st.deleteMaintenance);
  const addOdometerReading = useVehiclesStore((st) => st.addOdometerReading);
  const expenses = useExpensesStore((st) => st.expenses);

  const [viewingId, setViewingId] = useState<string | null>(vehicles[0]?.id ?? null);
  const viewing = vehicles.find((v) => v.id === viewingId) ?? null;
  const mainId = useMemo(() => mainCarId(vehicles), [vehicles]);

  const [fuelFormOpen, setFuelFormOpen] = useState(false);
  const [odoKm, setOdoKm] = useState('');
  const [fuelType, setFuelType] = useState<FuelType | null>(null);
  const [liters, setLiters] = useState('');
  const [amount, setAmount] = useState('');

  const [maintLabel, setMaintLabel] = useState('');
  const [maintInterval, setMaintInterval] = useState<number | undefined>(undefined);

  const handleAddVehicle = () => {
    haptic.tap();
    const v = addVehicle({ name: 'Nowy pojazd', kind: 'car', tag: '', color: SWATCHES[0] });
    setViewingId(v.id);
  };

  const summary = useMemo(() => (viewing ? summarizeVehicle(viewing, expenses, mainId) : null), [viewing, expenses, mainId]);
  const yearSummary = useMemo(() => (viewing ? vehicleYearSummary(viewing, expenses, mainId) : null), [viewing, expenses, mainId]);
  const perKm = useMemo(() => (viewing ? costPerKm(viewing, expenses, mainId) : null), [viewing, expenses, mainId]);
  const odometer = useMemo(() => (viewing ? currentOdometer(viewing) : null), [viewing]);
  const consumption = useMemo(() => (viewing && fuelType ? avgFuelConsumption(viewing, fuelType) : null), [viewing, fuelType]);
  // Rower/"Inny" nie mają sensownego przebiegu w typowym użyciu (2026-11-11,
  // user: "rower nie ma przebiegu xd") — stat km/zł-na-km się dla nich nie
  // pokazuje, patrz karta Statystyki niżej.
  const showMileageStats = viewing ? viewing.kind !== 'bike' && viewing.kind !== 'other' : true;

  // Data tankowania (2026-11-11) — wcześniej ZAWSZE dziś, więc tankowania
  // wpisanego dzień później (z paragonu) nie dało się zapisać poprawnie.
  const [fuelDate, setFuelDate] = useState(todayISO());
  const resetFuelForm = () => { setFuelFormOpen(false); setOdoKm(''); setFuelType(null); setLiters(''); setAmount(''); setFuelDate(todayISO()); };
  // Domyślny typ paliwa WIDOCZNIE zaznaczony (wcześniej przy kilku typach
  // cicho brało pierwszy, bez zaznaczonego chipa).
  const effectiveFuelType = fuelType ?? viewing?.fuelTypes?.[0] ?? null;
  const fuelKm = parseFloat(odoKm.replace(',', '.'));
  const fuelLiters = parseFloat(liters.replace(',', '.'));
  const fuelAmount = parseFloat(amount.replace(',', '.'));
  // Przycisk wyszarzony dopóki czegoś brakuje — wcześniej tap po cichu nic nie robił.
  const canSaveFuel = fuelKm > 0 && fuelLiters > 0 && fuelAmount > 0 && !!effectiveFuelType;
  const submitFuelLog = () => {
    if (!viewing || !canSaveFuel || !effectiveFuelType) return;
    haptic.success();
    logFuelFillUp(viewing.id, { date: fuelDate, odometerKm: fuelKm, fuelType: effectiveFuelType, liters: fuelLiters, amount: fuelAmount });
    resetFuelForm();
  };
  const openFuelDatePicker = () => {
    haptic.tap();
    DateTimePickerAndroid.open({
      value: new Date(`${fuelDate}T12:00:00`),
      mode: 'date',
      onChange: (event, selected) => { if (event.type === 'set' && selected) setFuelDate(ymd(selected)); },
    });
  };

  const [odoReadingKm, setOdoReadingKm] = useState('');
  const odoReadingValue = parseFloat(odoReadingKm.replace(',', '.'));
  const submitOdoReading = () => {
    if (!viewing || !(odoReadingValue > 0)) return;
    haptic.success();
    addOdometerReading(viewing.id, { date: todayISO(), km: odoReadingValue });
    setOdoReadingKm('');
  };
  // Literówka w przebiegu (np. 4200 zamiast 42000) psuje zł/km i spalanie —
  // ostrzeżenie zamiast cichego zapisu wartości mniejszej niż ostatnia.
  const lowerThanLast = (km: number) => odometer != null && km > 0 && km < odometer;

  const submitMaintenance = (label: string, intervalMonths?: number) => {
    if (!viewing || !label.trim()) return;
    haptic.success();
    addMaintenance(viewing.id, { label: label.trim(), date: todayISO(), intervalMonths });
    setMaintLabel(''); setMaintInterval(undefined);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Pojazdy</Text>
        <TouchableOpacity onPress={handleAddVehicle} style={s.backBtn} hitSlop={8}>
          <Plus size={20} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {vehicles.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {vehicles.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[s.vehChip, { borderColor: v.color }, v.id === viewingId && { backgroundColor: v.color }]}
              onPress={() => { haptic.tap(); setViewingId(v.id); }}
              activeOpacity={0.8}
            >
              <Text style={[s.vehChipLabel, v.id === viewingId && s.vehChipLabelOn]} numberOfLines={1}>{v.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!viewing ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>Brak pojazdów. Dodaj pierwszy, żeby śledzić przebieg, paliwo i serwis.</Text>
          <TouchableOpacity style={s.addBtn} onPress={handleAddVehicle} activeOpacity={0.8}>
            <Plus size={16} color={colors.bg.primary} />
            <Text style={s.addBtnLabel}>Dodaj pojazd</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Nazwa + usuń */}
          <View style={s.card}>
            <View style={s.rowBetween}>
              <TextInput
                value={viewing.name}
                onChangeText={(t) => updateVehicle(viewing.id, { name: t })}
                style={s.nameInput}
                placeholder="Nazwa pojazdu"
                placeholderTextColor={colors.text.muted}
              />
              <TouchableOpacity style={s.iconBtn} onPress={() => { haptic.tap(); deleteVehicle(viewing.id); setViewingId(vehicles.find((v) => v.id !== viewing.id)?.id ?? null); }} activeOpacity={0.8}>
                <Trash2 size={16} color={colors.accent.red} />
              </TouchableOpacity>
            </View>
            <View style={s.swatchRow}>
              {SWATCHES.map((c) => (
                <TouchableOpacity key={c} style={[s.swatch, { backgroundColor: c }, viewing.color === c && s.swatchOn]} onPress={() => updateVehicle(viewing.id, { color: c })} activeOpacity={0.8} />
              ))}
            </View>
          </View>

          {/* Rodzaj (kreator: pokazuje/chowa kolejne sekcje) */}
          <View style={s.card}>
            <Text style={s.label}>Rodzaj</Text>
            <View style={s.kindRow}>
              {KIND_OPTIONS.map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[s.kindChip, viewing.kind === k && s.kindChipOn]}
                  onPress={() => updateVehicle(viewing.id, { kind: k, ...(vehicleHasFuel(k) ? {} : { fuelTypes: undefined, isMainCar: false }) })}
                  activeOpacity={0.8}
                >
                  <Text style={[s.kindChipLabel, viewing.kind === k && s.kindChipLabelOn]}>{VEHICLE_KIND_LABEL[k]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.label, s.labelSpaced]}>Tag (auto-dopasowanie wydatków)</Text>
            <TextInput
              value={viewing.tag}
              onChangeText={(t) => updateVehicle(viewing.id, { tag: slugify(t) })}
              style={s.input}
              placeholder={slugify(viewing.name) || 'np. rower'}
              placeholderTextColor={colors.text.muted}
              autoCapitalize="none"
            />
            <Text style={s.hint}>Oznacz wydatek tagiem "{viewing.tag || slugify(viewing.name) || 'tag'}" w Finansach, a appka policzy go tutaj automatycznie.</Text>

            {vehicleHasFuel(viewing.kind) && (
              <>
                <Text style={[s.label, s.labelSpaced]}>Co pije</Text>
                <View style={s.kindRow}>
                  {FUEL_OPTIONS.map((f) => {
                    const on = (viewing.fuelTypes ?? []).includes(f);
                    return (
                      <TouchableOpacity
                        key={f}
                        style={[s.kindChip, on && s.kindChipOn]}
                        onPress={() => {
                          const cur = new Set(viewing.fuelTypes ?? []);
                          if (cur.has(f)) cur.delete(f); else cur.add(f);
                          updateVehicle(viewing.id, { fuelTypes: [...cur] });
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.kindChipLabel, on && s.kindChipLabelOn]}>{FUEL_TYPE_LABEL[f]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {viewing.kind === 'car' && (
                  <TouchableOpacity style={[s.pillBtn, s.labelSpaced, viewing.id === mainId && s.pillBtnOn]} onPress={() => setMainCar(viewing.id)} activeOpacity={0.8} disabled={viewing.id === mainId}>
                    <Star size={13} color={viewing.id === mainId ? colors.bg.primary : colors.text.secondary} />
                    <Text style={[s.pillLabel, viewing.id === mainId && s.pillLabelOn]}>{viewing.id === mainId ? 'Główny samochód' : 'Ustaw jako główny'}</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Statystyki */}
          <View style={s.card}>
            <Text style={s.label}>Statystyki</Text>
            <View style={s.statsRow}>
              {/* km / zł-na-km ukryte dla roweru/"inny" (2026-11-11, user: "rower
                  nie ma przebiegu xd" — te pojazdy nie mają sensownego przebiegu
                  w typowym użyciu, więc zamiast wiecznie pustego "—" ten stat po
                  prostu się nie pokazuje. "Odczyt licznika" niżej zostaje
                  dostępny — kto faktycznie śledzi km roweru, dalej może. */}
              {showMileageStats && (
                <>
                  <View style={s.statCol}>
                    <Text style={s.statNum}>{odometer != null ? odometer.toLocaleString('pl-PL') : '—'}</Text>
                    <Text style={s.statUnit}>km</Text>
                  </View>
                  <View style={s.statCol}>
                    <Text style={s.statNum}>{perKm ? perKm.value.toFixed(2) : '—'}</Text>
                    <Text style={s.statUnit}>zł / km</Text>
                  </View>
                </>
              )}
              <View style={s.statCol}>
                <Text style={s.statNum}>{summary ? summary.thisMonth.toFixed(0) : '—'}</Text>
                <Text style={s.statUnit}>zł ten miesiąc</Text>
              </View>
            </View>
            {yearSummary?.deltaPct != null && (
              <Text style={s.hint}>
                Ostatnie 12 mies.: {yearSummary.total.toFixed(0)} zł ({yearSummary.deltaPct > 0 ? '+' : ''}{yearSummary.deltaPct}% vs poprzednie 12 mies.)
              </Text>
            )}
          </View>

          {/* Zatankuj */}
          {vehicleHasFuel(viewing.kind) && (viewing.fuelTypes?.length ?? 0) > 0 && (
            <View style={s.card}>
              <TouchableOpacity style={s.summaryRow} onPress={() => setFuelFormOpen((v) => !v)} activeOpacity={0.7}>
                <View style={s.iconLabel}><Fuel size={14} color={colors.text.secondary} /><Text style={s.label}>Zatankuj</Text></View>
              </TouchableOpacity>
              {fuelFormOpen && (
                <View style={s.formBody}>
                  <Text style={[s.label, s.labelSpaced]}>Przebieg (km)</Text>
                  <TextInput value={odoKm} onChangeText={setOdoKm} style={s.input} keyboardType="decimal-pad" placeholder={odometer != null ? String(odometer) : 'np. 42000'} placeholderTextColor={colors.text.muted} />
                  {lowerThanLast(fuelKm) && (
                    <Text style={s.warnHint}>Mniej niż ostatni odczyt ({odometer?.toLocaleString('pl-PL')} km) — sprawdź, czy to nie literówka.</Text>
                  )}
                  {(viewing.fuelTypes?.length ?? 0) > 1 && (
                    <>
                      <Text style={[s.label, s.labelSpaced]}>Typ paliwa</Text>
                      <View style={s.kindRow}>
                        {(viewing.fuelTypes ?? []).map((f) => (
                          <TouchableOpacity key={f} style={[s.kindChip, effectiveFuelType === f && s.kindChipOn]} onPress={() => setFuelType(f)} activeOpacity={0.8}>
                            <Text style={[s.kindChipLabel, effectiveFuelType === f && s.kindChipLabelOn]}>{FUEL_TYPE_LABEL[f]}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                  <Text style={[s.label, s.labelSpaced]}>Litry</Text>
                  <TextInput value={liters} onChangeText={setLiters} style={s.input} keyboardType="decimal-pad" placeholder="np. 38.5" placeholderTextColor={colors.text.muted} />
                  <Text style={[s.label, s.labelSpaced]}>Kwota (zł)</Text>
                  <TextInput value={amount} onChangeText={setAmount} style={s.input} keyboardType="decimal-pad" placeholder="np. 210" placeholderTextColor={colors.text.muted} />
                  <Text style={[s.label, s.labelSpaced]}>Data</Text>
                  <View style={s.kindRow}>
                    {[{ label: 'Dziś', v: todayISO() }, { label: 'Wczoraj', v: ymd(new Date(Date.now() - 86400000)) }].map((opt) => (
                      <TouchableOpacity key={opt.label} style={[s.kindChip, fuelDate === opt.v && s.kindChipOn]} onPress={() => { haptic.tap(); setFuelDate(opt.v); }} activeOpacity={0.8}>
                        <Text style={[s.kindChipLabel, fuelDate === opt.v && s.kindChipLabelOn]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={s.kindChip} onPress={openFuelDatePicker} activeOpacity={0.8}>
                      <Text style={s.kindChipLabel}>{fuelDate}</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={[s.addBtn, s.labelSpaced, !canSaveFuel && s.btnDisabled]} onPress={submitFuelLog} disabled={!canSaveFuel} activeOpacity={0.8}>
                    <Plus size={16} color={colors.bg.primary} />
                    <Text style={s.addBtnLabel}>Zapisz tankowanie</Text>
                  </TouchableOpacity>
                  {consumption != null && <Text style={s.hint}>Średnie zużycie tego paliwa: {consumption.toFixed(1)} l/100km.</Text>}
                </View>
              )}
              {viewing.fuelLog.slice(0, 5).map((f) => (
                <View key={f.id} style={s.logRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.logMain}>{f.odometerKm.toLocaleString('pl-PL')} km · {FUEL_TYPE_LABEL[f.fuelType]}</Text>
                    <Text style={s.logSub}>{f.liters.toFixed(1)} l · {f.amount.toFixed(2)} zł · {f.date}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { haptic.tap(); deleteFuelLogEntry(viewing.id, f.id); }} hitSlop={8}>
                    <Trash2 size={14} color={colors.text.muted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Odczyt licznika (zawsze dostępny — np. rower bez paliwa) */}
          <View style={s.card}>
            <View style={s.iconLabel}><Gauge size={14} color={colors.text.secondary} /><Text style={s.label}>Odczyt licznika</Text></View>
            <View style={[s.rowBetween, s.labelSpaced]}>
              <TextInput value={odoReadingKm} onChangeText={setOdoReadingKm} style={[s.input, { flex: 1, marginTop: 0 }]} keyboardType="decimal-pad" placeholder={odometer != null ? `ostatnio ${odometer.toLocaleString('pl-PL')} km` : 'aktualny km'} placeholderTextColor={colors.text.muted} onSubmitEditing={submitOdoReading} returnKeyType="done" />
              <TouchableOpacity style={[s.iconBtn, !(odoReadingValue > 0) && s.btnDisabled]} onPress={submitOdoReading} disabled={!(odoReadingValue > 0)} activeOpacity={0.8}>
                <Plus size={16} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            {lowerThanLast(odoReadingValue) && (
              <Text style={s.warnHint}>Mniej niż ostatni odczyt ({odometer?.toLocaleString('pl-PL')} km) — sprawdź, czy to nie literówka.</Text>
            )}
          </View>

          {/* Serwis / części */}
          <View style={s.card}>
            <View style={s.iconLabel}><Wrench size={14} color={colors.text.secondary} /><Text style={s.label}>Serwis i części</Text></View>
            <View style={[s.kindRow, s.labelSpaced]}>
              {maintenancePresets(viewing.kind).map((p) => (
                <TouchableOpacity key={p.label} style={s.kindChip} onPress={() => submitMaintenance(p.label, p.intervalMonths)} activeOpacity={0.8}>
                  <Text style={s.kindChipLabel}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[s.rowBetween, s.labelSpaced]}>
              <TextInput value={maintLabel} onChangeText={setMaintLabel} style={[s.input, { flex: 1, marginTop: 0 }]} placeholder="Własna pozycja…" placeholderTextColor={colors.text.muted} onSubmitEditing={() => submitMaintenance(maintLabel, maintInterval)} />
              <TouchableOpacity style={s.iconBtn} onPress={() => submitMaintenance(maintLabel, maintInterval)} activeOpacity={0.8}>
                <Plus size={16} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            {viewing.maintenance.map((m) => {
              const due = maintenanceDueMonths(m);
              return (
                <View key={m.id} style={s.logRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.logMain}>{m.label}</Text>
                    <Text style={s.logSub}>{m.date}{due != null ? ` · ${maintenanceDueLabel(due)}` : ''}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { haptic.tap(); deleteMaintenance(viewing.id, m.id); }} hitSlop={8}>
                    <Trash2 size={14} color={colors.text.muted} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },

  chipRow: { paddingHorizontal: spacing[3], gap: spacing[2], paddingBottom: spacing[2] },
  vehChip: { paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.full, borderWidth: 1.5, backgroundColor: c.bg.elevated },
  vehChipLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  vehChipLabelOn: { color: c.bg.primary },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], paddingHorizontal: spacing[6] },
  emptyText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', lineHeight: 19 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.text.bright, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  addBtnLabel: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },

  scroll: { padding: spacing[4], paddingTop: spacing[2] },
  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], marginBottom: spacing[3] },

  nameInput: { flex: 1, fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.primary, paddingVertical: spacing[1] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },

  swatchRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  swatchOn: { borderWidth: 2, borderColor: c.text.primary },

  label: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelSpaced: { marginTop: spacing[3] },
  hint: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[2], lineHeight: 15 },
  warnHint: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.accent.red, marginTop: spacing[1], lineHeight: 15 },
  btnDisabled: { opacity: 0.4 },
  input: {
    marginTop: spacing[2], borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary,
  },

  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  kindChip: { paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  kindChipOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  kindChipLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  kindChipLabelOn: { color: c.bg.primary },

  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated, alignSelf: 'flex-start' },
  pillBtnOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  pillLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  pillLabelOn: { color: c.bg.primary },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing[3] },
  statCol: { alignItems: 'center' },
  statNum: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.primary },
  statUnit: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted, marginTop: 2 },

  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  formBody: { marginTop: spacing[1] },

  logRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: c.border.default, paddingTop: spacing[2], marginTop: spacing[2] },
  logMain: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  logSub: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },
}));
