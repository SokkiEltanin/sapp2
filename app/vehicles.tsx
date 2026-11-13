import { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Plus, Fuel, Gauge, Wrench, Trash2, Star, Pencil, AlertCircle } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import FuelSheet, { type FuelPrefill } from '@/components/vehicles/FuelSheet';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useExpensesStore } from '@/store/expensesStore';
import { deleteFuelLogEntry } from '@/services/vehicleFuelLog';
import {
  mainCarId, summarizeVehicle, vehicleYearSummary, vehicleStats, unlinkedFuelExpenses,
  maintenancePresets, maintenanceDueMonths, maintenanceDueLabel,
} from '@/utils/vehicleMatch';
import { FUEL_TYPE_LABEL, VEHICLE_KIND_LABEL, vehicleHasFuel, type VehicleKind, type FuelType, type Vehicle } from '@/types/vehicles';
import { haptic } from '@/utils/haptics';
import { todayISO } from '@/utils/date';

// Ekran "Pojazdy" (2026-11-09 port z sapp; przebudowa 2026-11-12 wg CLAUDE.md
// zasady 10 "ekran = dane, nie konfiguracja" — user: "zobacz ile miejsca zajmuje
// sam wybór koloru... a mało danych, np. z przebiegu ile km robię przy jakim
// spalaniu względem wydatków"). Układ:
//   1. Karta główna: nazwa + rodzaj/paliwo, siatka liczb (przebieg, km/mies.,
//      spalanie, zł/l, koszt 100 km, ten miesiąc + 12 mies.).
//   2. "Do uzupełnienia" — tankowania złapane jako wydatek (np. z banku) bez
//      litrów/przebiegu → tap otwiera FuelSheet podpięty do tego wydatku.
//   3. Akcje: Zatankuj / Licznik / Serwis — każda otwiera sheet.
//   4. Historia tankowań (z odcinkowym spalaniem) i serwis.
// Nazwa/kolor/rodzaj/tag/paliwo/główny/usuń → sheet "Edytuj" (ołówek).

const KIND_OPTIONS: VehicleKind[] = ['car', 'motorcycle', 'scooter', 'bike', 'other'];
const FUEL_OPTIONS: FuelType[] = ['benzyna', 'diesel', 'lpg', 'elektryczny'];
const SWATCHES = [colors.accent.blue, colors.accent.orange, colors.accent.green, colors.accent.red, colors.accent.purple, colors.text.bright];

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
    .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ż/g, 'z').replace(/ź/g, 'z')
    .replace(/[^a-z0-9]+/g, '').slice(0, 20);
}
const pl = (n: number, d = 0) => n.toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d });
const ddmm = (iso: string) => { const [, m, d] = iso.slice(0, 10).split('-'); return `${d}.${m}`; };

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

  // ?id= — wejście z Wymian (stuknięcie w serwis konkretnego pojazdu).
  const { id: paramId } = useLocalSearchParams<{ id?: string }>();
  const [viewingId, setViewingId] = useState<string | null>((paramId && vehicles.some((v) => v.id === paramId) ? paramId : null) ?? vehicles[0]?.id ?? null);
  const viewing = vehicles.find((v) => v.id === viewingId) ?? null;
  const mainId = useMemo(() => mainCarId(vehicles), [vehicles]);

  const [editOpen, setEditOpen] = useState(false);
  const [fuelFor, setFuelFor] = useState<{ vehicle: Vehicle; prefill?: FuelPrefill } | null>(null);
  const [odoOpen, setOdoOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);

  const handleAddVehicle = () => {
    haptic.tap();
    const v = addVehicle({ name: 'Nowy pojazd', kind: 'car', tag: '', color: SWATCHES[0] });
    setViewingId(v.id);
    setEditOpen(true); // nowy pojazd = od razu konfiguracja (jedyny moment, kiedy jest potrzebna)
  };

  const summary = useMemo(() => (viewing ? summarizeVehicle(viewing, expenses, mainId) : null), [viewing, expenses, mainId]);
  const year = useMemo(() => (viewing ? vehicleYearSummary(viewing, expenses, mainId) : null), [viewing, expenses, mainId]);
  const stats = useMemo(() => (viewing ? vehicleStats(viewing, expenses, mainId) : null), [viewing, expenses, mainId]);
  const toFill = useMemo(() => (viewing && vehicleHasFuel(viewing.kind) ? unlinkedFuelExpenses(viewing, expenses, mainId) : []), [viewing, expenses, mainId]);
  const hasFuel = viewing ? vehicleHasFuel(viewing.kind) : false;
  const showMileage = viewing ? viewing.kind !== 'bike' && viewing.kind !== 'other' : true;

  // Kafelki liczb — puste "—" z podpowiedzią, czego brakuje, zamiast znikać.
  const tiles = useMemo(() => {
    if (!viewing || !stats || !summary) return [];
    const t: { k: string; v: string; u: string; sub?: string }[] = [];
    if (showMileage) {
      t.push({ k: 'odo', v: stats.odometer != null ? pl(stats.odometer) : '—', u: 'km przebiegu', sub: stats.kmThisMonth != null ? `+${pl(stats.kmThisMonth)} km w tym mies.` : undefined });
      t.push({ k: 'kmm', v: stats.kmPerMonth != null ? pl(stats.kmPerMonth) : '—', u: 'km / miesiąc', sub: stats.kmPerMonth == null ? 'potrzeba 2 odczytów' : 'średnio' });
    }
    if (hasFuel) {
      t.push({ k: 'cons', v: stats.consumption != null ? pl(stats.consumption, 1) : '—', u: 'l / 100 km', sub: stats.consumption != null && stats.mainFuel ? FUEL_TYPE_LABEL[stats.mainFuel as FuelType] : 'potrzeba 2 tankowań' });
      t.push({ k: 'ppl', v: stats.avgPricePerLiter != null ? pl(stats.avgPricePerLiter, 2) : '—', u: 'zł / litr', sub: stats.lastFillDaysAgo != null ? `tankowano ${stats.lastFillDaysAgo === 0 ? 'dziś' : `${stats.lastFillDaysAgo} dni temu`}` : undefined });
    }
    if (showMileage) {
      t.push({ k: 'c100', v: stats.costPer100km != null ? pl(stats.costPer100km) : '—', u: 'zł / 100 km', sub: stats.fuelPer100km != null ? `w tym paliwo ${pl(stats.fuelPer100km)} zł` : 'wszystkie koszty' });
    }
    t.push({ k: 'month', v: pl(summary.thisMonth), u: 'zł w tym mies.', sub: year && year.total > 0 ? `12 mies.: ${pl(year.total)} zł${year.deltaPct != null ? ` (${year.deltaPct > 0 ? '+' : ''}${year.deltaPct}%)` : ''}` : undefined });
    return t;
  }, [viewing, stats, summary, year, showMileage, hasFuel]);

  const openFuel = (prefill?: FuelPrefill) => { if (!viewing) return; haptic.tap(); setFuelFor({ vehicle: viewing, prefill }); };

  // ── Licznik ──
  const odoRef = useRef<TextInput>(null);
  const [odoKm, setOdoKm] = useState('');
  const odoVal = parseFloat(odoKm.replace(',', '.'));
  const submitOdo = () => {
    if (!viewing || !(odoVal > 0)) return;
    haptic.success();
    addOdometerReading(viewing.id, { date: todayISO(), km: odoVal });
    setOdoKm(''); setOdoOpen(false);
  };

  // ── Serwis ──
  const [maintLabel, setMaintLabel] = useState('');
  const submitMaintenance = (label: string, intervalMonths?: number) => {
    if (!viewing || !label.trim()) return;
    haptic.success();
    addMaintenance(viewing.id, { label: label.trim(), date: todayISO(), intervalMonths });
    setMaintLabel(''); setMaintOpen(false);
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow} style={s.chipScroll}>
          {vehicles.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[s.vehChip, v.id === viewingId && s.vehChipOn]}
              onPress={() => { haptic.tap(); setViewingId(v.id); }}
              activeOpacity={0.8}
            >
              <View style={[s.vehDot, { backgroundColor: v.color }]} />
              <Text style={[s.vehChipLabel, v.id === viewingId && s.vehChipLabelOn]} numberOfLines={1}>{v.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!viewing ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>Brak pojazdów. Dodaj pierwszy, żeby śledzić przebieg, spalanie i koszty.</Text>
          <TouchableOpacity style={s.addBtn} onPress={handleAddVehicle} activeOpacity={0.8}>
            <Plus size={16} color={colors.bg.primary} />
            <Text style={s.addBtnLabel}>Dodaj pojazd</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* 1. Karta główna */}
          <View style={s.card}>
            <View style={s.heroHead}>
              <View style={[s.heroDot, { backgroundColor: viewing.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.heroName} numberOfLines={1}>{viewing.name}</Text>
                <Text style={s.heroSub} numberOfLines={1}>
                  {VEHICLE_KIND_LABEL[viewing.kind]}
                  {viewing.fuelTypes?.length ? ` · ${viewing.fuelTypes.map((f) => FUEL_TYPE_LABEL[f]).join(' + ')}` : ''}
                  {viewing.id === mainId ? ' · główny' : ''}
                </Text>
              </View>
              <TouchableOpacity style={s.iconBtn} onPress={() => { haptic.tap(); setEditOpen(true); }} hitSlop={6} accessibilityLabel="Edytuj pojazd">
                <Pencil size={15} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={s.grid}>
              {tiles.map((t) => (
                <View key={t.k} style={s.gridCell}>
                  <Text style={[s.gridNum, t.v === '—' && { color: colors.text.muted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t.v}</Text>
                  <Text style={s.gridUnit} numberOfLines={1}>{t.u}</Text>
                  {t.sub ? <Text style={s.gridSub} numberOfLines={1}>{t.sub}</Text> : null}
                </View>
              ))}
            </View>
          </View>

          {/* 2. Do uzupełnienia */}
          {toFill.length > 0 && (
            <View style={[s.card, s.cardWarn]}>
              <View style={s.iconLabel}>
                <AlertCircle size={14} color={colors.accent.orange} />
                <Text style={[s.label, { color: colors.accent.orange }]}>Tankowania do uzupełnienia</Text>
              </View>
              {toFill.slice(0, 4).map((e) => (
                <TouchableOpacity
                  key={e.id}
                  style={s.logRow}
                  onPress={() => openFuel({ expenseId: e.id, amount: e.amount, date: e.date, label: `${e.storeName || e.note || 'Wydatek'} · ${pl(e.amount, 2)} zł · ${ddmm(e.date)}` })}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.logMain} numberOfLines={1}>{e.storeName || e.note || 'Wydatek'} · {pl(e.amount, 2)} zł</Text>
                    <Text style={s.logSub}>{ddmm(e.date)} · brak litrów i przebiegu</Text>
                  </View>
                  <Text style={s.fillLink}>Uzupełnij</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 3. Akcje */}
          <View style={s.actions}>
            {hasFuel && (
              <TouchableOpacity style={[s.actBtn, s.actPrimary]} onPress={() => openFuel()} activeOpacity={0.8}>
                <Fuel size={15} color={colors.bg.primary} />
                <Text style={[s.actLabel, { color: colors.bg.primary }]}>Zatankuj</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.actBtn} onPress={() => { haptic.tap(); setOdoOpen(true); }} activeOpacity={0.8}>
              <Gauge size={15} color={colors.text.secondary} />
              <Text style={s.actLabel}>Licznik</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actBtn} onPress={() => { haptic.tap(); setMaintOpen(true); }} activeOpacity={0.8}>
              <Wrench size={15} color={colors.text.secondary} />
              <Text style={s.actLabel}>Serwis</Text>
            </TouchableOpacity>
          </View>

          {/* 4. Historia tankowań */}
          {stats && stats.fills.length > 0 && (
            <View style={s.card}>
              <Text style={s.label}>Tankowania</Text>
              {stats.fills.slice(0, 6).map((f) => (
                <View key={f.id} style={s.logRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.logMain}>{ddmm(f.date)} · {pl(f.liters, 1)} l · {pl(f.amount, 2)} zł</Text>
                    <Text style={s.logSub}>
                      {pl(f.odometerKm)} km
                      {f.pricePerLiter != null ? ` · ${pl(f.pricePerLiter, 2)} zł/l` : ''}
                      {f.kmSincePrev != null ? ` · +${pl(f.kmSincePrev)} km` : ''}
                    </Text>
                  </View>
                  {f.consumption != null && <Text style={s.consBadge}>{pl(f.consumption, 1)} l/100</Text>}
                  <TouchableOpacity onPress={() => { haptic.tap(); deleteFuelLogEntry(viewing.id, f.id); }} hitSlop={8} style={{ marginLeft: spacing[2] }}>
                    <Trash2 size={14} color={colors.text.muted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Serwis */}
          {viewing.maintenance.length > 0 && (
            <View style={s.card}>
              <Text style={s.label}>Serwis i części</Text>
              {viewing.maintenance.map((m) => {
                const due = maintenanceDueMonths(m);
                return (
                  <View key={m.id} style={s.logRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.logMain}>{m.label}</Text>
                      <Text style={[s.logSub, due != null && due < 0 && { color: colors.accent.red }]}>{ddmm(m.date)}.{m.date.slice(0, 4)}{due != null ? ` · ${maintenanceDueLabel(due)}` : ''}</Text>
                    </View>
                    <TouchableOpacity onPress={() => { haptic.tap(); deleteMaintenance(viewing.id, m.id); }} hitSlop={8}>
                      <Trash2 size={14} color={colors.text.muted} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Sheety ── */}
      <FuelSheet vehicle={fuelFor?.vehicle ?? null} prefill={fuelFor?.prefill} onClose={() => setFuelFor(null)} />

      <AppBottomSheet visible={odoOpen && !!viewing} onClose={() => setOdoOpen(false)} initialFocusRef={odoRef} scrollable={false}>
        <Text style={s.sheetTitle}>Odczyt licznika</Text>
        <View style={s.rowBetween}>
          <TextInput ref={odoRef} value={odoKm} onChangeText={setOdoKm} style={[s.input, { flex: 1, marginTop: 0 }]} keyboardType="decimal-pad"
            placeholder={stats?.odometer != null ? `ostatnio ${pl(stats.odometer)} km` : 'aktualny km'} placeholderTextColor={colors.text.muted}
            onSubmitEditing={submitOdo} returnKeyType="done" />
          <TouchableOpacity style={[s.addBtn, !(odoVal > 0) && s.btnDisabled]} onPress={submitOdo} disabled={!(odoVal > 0)} activeOpacity={0.8}>
            <Text style={s.addBtnLabel}>Zapisz</Text>
          </TouchableOpacity>
        </View>
        {stats?.odometer != null && odoVal > 0 && odoVal < stats.odometer && (
          <Text style={s.warnHint}>Mniej niż ostatni odczyt ({pl(stats.odometer)} km) — literówka?</Text>
        )}
      </AppBottomSheet>

      <AppBottomSheet visible={maintOpen && !!viewing} onClose={() => setMaintOpen(false)}>
        <Text style={s.sheetTitle}>Serwis / części</Text>
        <View style={s.kindRow}>
          {viewing && maintenancePresets(viewing.kind).map((p) => (
            <TouchableOpacity key={p.label} style={s.kindChip} onPress={() => submitMaintenance(p.label, p.intervalMonths)} activeOpacity={0.8}>
              <Text style={s.kindChipLabel}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={[s.rowBetween, s.spaced]}>
          <TextInput value={maintLabel} onChangeText={setMaintLabel} style={[s.input, { flex: 1, marginTop: 0 }]} placeholder="Własna pozycja…" placeholderTextColor={colors.text.muted} onSubmitEditing={() => submitMaintenance(maintLabel)} />
          <TouchableOpacity style={[s.addBtn, !maintLabel.trim() && s.btnDisabled]} onPress={() => submitMaintenance(maintLabel)} disabled={!maintLabel.trim()} activeOpacity={0.8}>
            <Text style={s.addBtnLabel}>Dodaj</Text>
          </TouchableOpacity>
        </View>
      </AppBottomSheet>

      <AppBottomSheet visible={editOpen && !!viewing} onClose={() => setEditOpen(false)}>
        {viewing && (
          <>
            <Text style={s.sheetTitle}>Edytuj pojazd</Text>
            <Text style={s.label}>Nazwa</Text>
            <TextInput value={viewing.name} onChangeText={(t) => updateVehicle(viewing.id, { name: t })} style={s.input} placeholder="Nazwa pojazdu" placeholderTextColor={colors.text.muted} />

            <View style={[s.swatchRow, s.spaced]}>
              {SWATCHES.map((c) => (
                <TouchableOpacity key={c} style={[s.swatch, { backgroundColor: c }, viewing.color === c && s.swatchOn]} onPress={() => updateVehicle(viewing.id, { color: c })} activeOpacity={0.8} />
              ))}
            </View>

            <Text style={[s.label, s.spaced]}>Rodzaj</Text>
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

            {vehicleHasFuel(viewing.kind) && (
              <>
                <Text style={[s.label, s.spaced]}>Co pije</Text>
                <View style={s.kindRow}>
                  {FUEL_OPTIONS.map((f) => {
                    const on = (viewing.fuelTypes ?? []).includes(f);
                    return (
                      <TouchableOpacity key={f} style={[s.kindChip, on && s.kindChipOn]} activeOpacity={0.8}
                        onPress={() => {
                          const cur = new Set(viewing.fuelTypes ?? []);
                          if (cur.has(f)) cur.delete(f); else cur.add(f);
                          updateVehicle(viewing.id, { fuelTypes: [...cur] });
                        }}>
                        <Text style={[s.kindChipLabel, on && s.kindChipLabelOn]}>{FUEL_TYPE_LABEL[f]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={[s.label, s.spaced]}>Tag wydatków</Text>
            <TextInput value={viewing.tag} onChangeText={(t) => updateVehicle(viewing.id, { tag: slugify(t) })} style={s.input}
              placeholder={slugify(viewing.name) || 'np. auto'} placeholderTextColor={colors.text.muted} autoCapitalize="none" />
            <Text style={s.hint}>Wydatki z tym tagiem liczą się do tego pojazdu.</Text>

            <View style={[s.rowBetween, s.spaced]}>
              {viewing.kind === 'car' ? (
                <TouchableOpacity style={[s.pillBtn, viewing.id === mainId && s.pillBtnOn]} onPress={() => setMainCar(viewing.id)} activeOpacity={0.8} disabled={viewing.id === mainId}>
                  <Star size={13} color={viewing.id === mainId ? colors.bg.primary : colors.text.secondary} />
                  <Text style={[s.pillLabel, viewing.id === mainId && s.pillLabelOn]}>{viewing.id === mainId ? 'Główny (łapie paliwo)' : 'Ustaw jako główny'}</Text>
                </TouchableOpacity>
              ) : <View />}
              <TouchableOpacity
                style={s.deleteBtn}
                onPress={() => {
                  haptic.medium();
                  const next = vehicles.find((v) => v.id !== viewing.id)?.id ?? null;
                  setEditOpen(false);
                  deleteVehicle(viewing.id);
                  setViewingId(next);
                }}
                activeOpacity={0.8}
              >
                <Trash2 size={14} color={colors.accent.red} />
                <Text style={s.deleteLabel}>Usuń pojazd</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },

  chipScroll: { flexGrow: 0 },
  chipRow: { paddingHorizontal: spacing[4], gap: spacing[2], paddingBottom: spacing[2] },
  vehChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  vehChipOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  vehDot: { width: 8, height: 8, borderRadius: 4 },
  vehChipLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  vehChipLabelOn: { color: c.bg.primary },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], paddingHorizontal: spacing[6] },
  emptyText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', lineHeight: 19 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.text.bright, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  addBtnLabel: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },

  scroll: { padding: spacing[4], paddingTop: spacing[2] },
  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], marginBottom: spacing[3] },
  cardWarn: { borderColor: c.accent.orange + '55' },

  heroHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  heroDot: { width: 10, height: 10, borderRadius: 5 },
  heroName: { fontSize: 18, fontFamily: 'Inter_900Black', color: c.text.primary },
  heroSub: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing[4], rowGap: spacing[4] },
  gridCell: { width: '50%', paddingRight: spacing[2] },
  gridNum: { fontSize: 24, fontFamily: 'Inter_900Black', color: c.text.primary, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  gridUnit: { fontSize: 10, fontFamily: 'Inter_700Bold', color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 1 },
  gridSub: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },

  actions: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing[3], borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  actPrimary: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  actLabel: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  iconLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  sheetTitle: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary, marginBottom: spacing[3] },
  swatchRow: { flexDirection: 'row', gap: spacing[2] },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  swatchOn: { borderWidth: 2, borderColor: c.text.primary },

  label: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  spaced: { marginTop: spacing[3] },
  hint: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[1], lineHeight: 15 },
  warnHint: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.accent.red, marginTop: spacing[1], lineHeight: 15 },
  btnDisabled: { opacity: 0.4 },
  input: {
    marginTop: spacing[2], borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary,
  },

  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  kindChip: { paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  kindChipOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  kindChipLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  kindChipLabelOn: { color: c.bg.primary },

  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  pillBtnOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  pillLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  pillLabelOn: { color: c.bg.primary },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: 8 },
  deleteLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.accent.red },

  logRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: c.border.default, paddingTop: spacing[2], marginTop: spacing[2] },
  logMain: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  logSub: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },
  consBadge: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary, backgroundColor: c.bg.elevated, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  fillLink: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.accent.orange },
}));
