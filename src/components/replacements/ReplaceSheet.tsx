import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as LucideIcons from 'lucide-react-native';
import { CalendarDays, Minus, Plus, Trash2, Undo2, ChevronDown, ChevronUp, Home, Car } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useReplacementsStore } from '@/store/replacementsStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { maintenancePresets } from '@/utils/vehicleMatch';
import type { ReplaceItem, ReplaceUnit } from '@/types/replacements';
import { REPLACE_PRESETS, presetByKey, everyLabel, addInterval, realAvgDays, CAR_REMIND_DAYS } from '@/utils/replacements';
import { toDisplayDate, parseDisplayDate, maskDateDigits } from '@/utils/dateInput';
import { todayISO, ymd } from '@/utils/date';
import { haptic } from '@/utils/haptics';

// Formularz wymiany (2026-11-13, user: "ogarnij też formularz dodawania"):
// szablon (filtr w dzbanku, końcówki szczoteczki…) wypełnia wszystko jednym
// stuknięciem; potem nazwa, co ile (liczba + dni/tyg./mies.), kiedy ostatnio,
// przypomnienie i słowa z paragonu. W edycji dodatkowo historia wymian.
// "Gdzie": Dom albo pojazd — wymiana w aucie (olej, klocki…) zapisuje się jako
// serwis tego pojazdu (vehiclesStore), żeby Pojazdy i Wymiany miały te same dane.
// Szablony domyślnie zwinięte (user: "zajmują dużo miejsca").

export const ReplaceIcon = ({ name, size = 16, color = colors.text.primary }: { name?: string; size?: number; color?: string }) => {
  const C = (name && (LucideIcons as any)[name]) || LucideIcons.RefreshCw;
  return <C size={size} color={color} />;
};

const UNITS: { key: ReplaceUnit; label: string }[] = [
  { key: 'd', label: 'dni' }, { key: 'w', label: 'tyg.' }, { key: 'm', label: 'mies.' },
];
const REMIND: { v: number; label: string }[] = [
  { v: -1, label: 'Brak' }, { v: 0, label: 'W dniu' }, { v: 1, label: 'Dzień przed' }, { v: 3, label: '3 dni przed' }, { v: 7, label: 'Tydzień przed' },
];
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

export default function ReplaceSheet({ visible, onClose, editing, presetKey }: {
  visible: boolean; onClose: () => void; editing?: ReplaceItem | null; presetKey?: string | null;
}) {
  const s = makeS();
  const add = useReplacementsStore((st) => st.add);
  const update = useReplacementsStore((st) => st.update);
  const remove = useReplacementsStore((st) => st.remove);
  const undo = useReplacementsStore((st) => st.undo);
  const live = useReplacementsStore((st) => (editing ? st.items.find((x) => x.id === editing.id) : undefined));
  const vehicles = useVehiclesStore((st) => st.vehicles);
  const addMaintenance = useVehiclesStore((st) => st.addMaintenance);
  const [target, setTarget] = useState<string>('home'); // 'home' | vehicleId
  const [presetsOpen, setPresetsOpen] = useState(false);

  const [preset, setPreset] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [every, setEvery] = useState('1');
  const [unit, setUnit] = useState<ReplaceUnit>('m');
  const [last, setLast] = useState(toDisplayDate(todayISO()));
  const [remind, setRemind] = useState(0);
  const [keywords, setKeywords] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const nameRef = useRef<TextInput>(null);

  const applyPreset = (key: string) => {
    const p = presetByKey(key);
    if (!p) return;
    setPreset(p.key); setName(p.name); setEvery(String(p.every)); setUnit(p.unit); setKeywords(p.keywords.join(', '));
  };

  useEffect(() => {
    if (!visible) return;
    setConfirmDel(false);
    setTarget('home');
    setPresetsOpen(false);
    if (editing) {
      setPreset(editing.preset); setName(editing.name); setEvery(String(editing.every)); setUnit(editing.unit);
      setLast(toDisplayDate(editing.lastDate)); setRemind(editing.remindDaysBefore); setKeywords(editing.keywords.join(', '));
    } else {
      setPreset(undefined); setName(''); setEvery('1'); setUnit('m'); setLast(toDisplayDate(todayISO())); setRemind(0); setKeywords('');
      if (presetKey) applyPreset(presetKey);
    }
  }, [visible, editing?.id, presetKey]);

  const everyN = Math.max(0, Math.round(Number(every.replace(',', '.')) || 0));
  const lastIso = parseDisplayDate(last);
  const valid = name.trim().length > 0 && everyN > 0 && !!lastIso;
  const nextIso = lastIso && everyN > 0 ? addInterval(lastIso, everyN, unit) : null;

  const step = (d: number) => { haptic.tap(); setEvery(String(Math.max(1, everyN + d))); };
  const openPicker = () => {
    haptic.tap();
    if (Platform.OS !== 'android') return;
    DateTimePickerAndroid.open({
      value: new Date(`${lastIso ?? todayISO()}T12:00:00`), mode: 'date', maximumDate: new Date(),
      onChange: (e, d) => { if (e.type === 'set' && d) setLast(toDisplayDate(ymd(d))); },
    });
  };

  const vehicle = vehicles.find((v) => v.id === target);
  const carPresets = vehicle ? maintenancePresets(vehicle.kind).filter((p) => p.intervalMonths) : [];
  const pickTarget = (t: string) => {
    haptic.tap();
    setTarget(t);
    setPreset(undefined);
    if (t !== 'home') { setUnit('m'); setName(''); setEvery('12'); setKeywords(''); }
  };

  const save = () => {
    if (!valid || !lastIso) return;
    haptic.success();
    if (vehicle) {
      addMaintenance(vehicle.id, { label: name.trim(), date: lastIso, intervalMonths: unit === 'm' ? everyN : Math.max(1, Math.round(everyN / (unit === 'w' ? 4.35 : 30.44))) });
      onClose();
      return;
    }
    const data = {
      name: name.trim(), preset, every: everyN, unit, remindDaysBefore: remind,
      keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
    };
    if (editing) {
      // Zmiana daty ostatniej wymiany w edycji = poprawka (nie nowa wymiana).
      update(editing.id, { ...data, lastDate: lastIso });
    } else {
      add({ ...data, lastDate: lastIso });
    }
    onClose();
  };

  const history = live ? [live.lastDate, ...live.history] : [];
  const avg = live ? realAvgDays(live) : null;
  const quickDates = useMemo(() => [
    { label: 'dziś', iso: todayISO() }, { label: 'wczoraj', iso: daysAgo(1) }, { label: 'tydzień temu', iso: daysAgo(7) }, { label: 'miesiąc temu', iso: daysAgo(30) },
  ], [visible]);

  const footer = (
    <View style={s.footer}>
      {editing && (
        <TouchableOpacity style={[s.delBtn, confirmDel && s.delBtnOn]} onPress={() => {
          haptic.tap();
          if (!confirmDel) { setConfirmDel(true); return; }
          remove(editing.id); onClose();
        }} activeOpacity={0.8}>
          <Trash2 size={15} color={confirmDel ? colors.bg.primary : colors.accent.red} />
          {confirmDel && <Text style={s.delLabel}>Usuń</Text>}
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[s.saveBtn, !valid && s.disabled]} onPress={save} disabled={!valid} activeOpacity={0.85}>
        <Text style={s.saveLabel}>{editing ? 'Zapisz' : 'Dodaj'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <AppBottomSheet visible={visible} onClose={onClose} footer={footer} maxHeightRatio={0.9}
      header={<Text style={s.title}>{editing ? editing.name : 'Nowa wymiana'}</Text>}>
      {!editing && vehicles.length > 0 && (
        <View style={[s.chips, { marginTop: 0, marginBottom: spacing[3] }]}>
          {[{ id: 'home', name: 'Dom' }, ...vehicles.map((v) => ({ id: v.id, name: v.name }))].map((t) => {
            const on = target === t.id;
            const Ico = t.id === 'home' ? Home : Car;
            return (
              <TouchableOpacity key={t.id} style={[s.chip, s.targetChip, on && s.chipOn]} onPress={() => pickTarget(t.id)} activeOpacity={0.8}>
                <Ico size={12} color={on ? colors.bg.primary : colors.text.secondary} />
                <Text style={[s.chipLabel, on && s.chipLabelOn]} numberOfLines={1}>{t.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!editing && (vehicle ? carPresets.length > 0 : true) && (
        <>
          <TouchableOpacity style={s.toggle} onPress={() => { haptic.tap(); setPresetsOpen((v) => !v); }} activeOpacity={0.7}>
            <Text style={s.label}>Szablony{preset ? ` · ${presetByKey(preset)?.name ?? ''}` : ''}</Text>
            {presetsOpen ? <ChevronUp size={14} color={colors.text.muted} /> : <ChevronDown size={14} color={colors.text.muted} />}
          </TouchableOpacity>
          {presetsOpen && (
            <View style={s.presetGrid}>
              {vehicle ? carPresets.map((p) => {
                const on = name === p.label;
                return (
                  <TouchableOpacity key={p.label} style={[s.preset, on && s.presetOn]} onPress={() => { haptic.tap(); setName(p.label); setEvery(String(p.intervalMonths)); setUnit('m'); setPresetsOpen(false); }} activeOpacity={0.8}>
                    <Car size={14} color={on ? colors.bg.primary : colors.text.secondary} />
                    <Text style={[s.presetLabel, on && s.presetLabelOn]} numberOfLines={2}>{p.label}</Text>
                  </TouchableOpacity>
                );
              }) : REPLACE_PRESETS.map((p) => {
                const on = preset === p.key;
                return (
                  <TouchableOpacity key={p.key} style={[s.preset, on && s.presetOn]} onPress={() => { haptic.tap(); applyPreset(p.key); setPresetsOpen(false); }} activeOpacity={0.8}>
                    <ReplaceIcon name={p.icon} size={14} color={on ? colors.bg.primary : colors.text.secondary} />
                    <Text style={[s.presetLabel, on && s.presetLabelOn]} numberOfLines={2}>{p.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}

      <Text style={[s.label, !editing && s.gap]}>Nazwa</Text>
      <TextInput ref={nameRef} value={name} onChangeText={setName} style={s.input} placeholder={vehicle ? "np. Wymiana oleju" : "np. Filtr w dzbanku"} placeholderTextColor={colors.text.muted} />

      <Text style={[s.label, s.gap]}>Co ile</Text>
      <View style={s.row}>
        <TouchableOpacity style={s.stepBtn} onPress={() => step(-1)} hitSlop={6}><Minus size={16} color={colors.text.primary} /></TouchableOpacity>
        <TextInput value={every} onChangeText={(v) => setEvery(v.replace(/\D/g, '').slice(0, 3))} style={[s.input, s.numInput]} keyboardType="number-pad" />
        <TouchableOpacity style={s.stepBtn} onPress={() => step(1)} hitSlop={6}><Plus size={16} color={colors.text.primary} /></TouchableOpacity>
        <View style={s.seg}>
          {(vehicle ? UNITS.filter((u) => u.key === 'm') : UNITS).map((u) => (
            <TouchableOpacity key={u.key} style={[s.segItem, unit === u.key && s.segOn]} onPress={() => { haptic.tap(); setUnit(u.key); }} activeOpacity={0.8}>
              <Text style={[s.segLabel, unit === u.key && s.segLabelOn]}>{u.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={[s.label, s.gap]}>{editing ? 'Ostatnia wymiana (poprawka daty)' : 'Ostatnio wymienione'}</Text>
      <View style={s.chips}>
        {quickDates.map((q) => {
          const on = lastIso === q.iso;
          return (
            <TouchableOpacity key={q.label} style={[s.chip, on && s.chipOn]} onPress={() => { haptic.tap(); setLast(toDisplayDate(q.iso)); }} activeOpacity={0.8}>
              <Text style={[s.chipLabel, on && s.chipLabelOn]}>{q.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={[s.row, { marginTop: spacing[2] }]}>
        <TextInput value={last} onChangeText={(v) => setLast(maskDateDigits(v))} style={[s.input, { flex: 1, marginTop: 0 }]} keyboardType="number-pad" placeholder="DD.MM.RRRR" placeholderTextColor={colors.text.muted} />
        <TouchableOpacity style={s.stepBtn} onPress={openPicker} accessibilityLabel="Wybierz z kalendarza"><CalendarDays size={16} color={colors.text.secondary} /></TouchableOpacity>
      </View>
      <Text style={[s.hint, !lastIso && last.length === 10 && { color: colors.accent.red }]}>
        {nextIso ? `${everyLabel(everyN, unit)} · następna ${toDisplayDate(nextIso)}` : last.length === 10 ? 'Niepoprawna data' : ' '}
      </Text>

      {vehicle ? (
        <Text style={[s.hint, s.gap]}>Zapisze się jako serwis pojazdu {vehicle.name} (widać też w Pojazdach). Przypomnienie {CAR_REMIND_DAYS} dni przed terminem.</Text>
      ) : (
        <>
      <Text style={[s.label, s.gap]}>Przypomnienie</Text>
      <View style={s.chips}>
        {REMIND.map((r) => {
          const on = remind === r.v;
          return (
            <TouchableOpacity key={r.v} style={[s.chip, on && s.chipOn]} onPress={() => { haptic.tap(); setRemind(r.v); }} activeOpacity={0.8}>
              <Text style={[s.chipLabel, on && s.chipLabelOn]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[s.label, s.gap]}>Słowa z paragonu</Text>
      <TextInput value={keywords} onChangeText={setKeywords} style={s.input} placeholder="np. dafi, brita" placeholderTextColor={colors.text.muted} autoCapitalize="none" />
      <Text style={s.hint}>Zakup z tym słowem na paragonie podpowie „wymienione?” i policzy koszt na rok.</Text>

        </>
      )}

      {editing && history.length > 0 && (
        <>
          <View style={[s.row, s.gap, { justifyContent: 'space-between' }]}>
            <Text style={s.label}>Historia{avg ? ` · realnie co ~${avg} dni` : ''}</Text>
            {history.length > 1 && (
              <TouchableOpacity style={s.undo} onPress={() => { haptic.tap(); undo(editing.id); if (live?.history[0]) setLast(toDisplayDate(live.history[0])); }} hitSlop={8}>
                <Undo2 size={12} color={colors.text.secondary} />
                <Text style={s.undoLabel}>cofnij ostatnią</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={s.chips}>
            {history.slice(0, 12).map((d, i) => (
              <View key={d} style={[s.histChip, i === 0 && s.histChipFirst]}>
                <Text style={[s.histLabel, i === 0 && { color: colors.text.primary }]}>{toDisplayDate(d)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary, paddingBottom: spacing[2] },
  label: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  gap: { marginTop: spacing[4] },
  hint: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[1], lineHeight: 15 },
  input: {
    marginTop: spacing[2], borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  numInput: { width: 54, textAlign: 'center', marginTop: 0 },
  stepBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  seg: { flex: 1, flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, overflow: 'hidden' },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 9 },
  segOn: { backgroundColor: c.text.bright },
  segLabel: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  segLabelOn: { color: c.bg.primary },

  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  preset: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: 9, borderRadius: radius.md, backgroundColor: c.ui.in },
  presetOn: { backgroundColor: c.text.bright },
  presetLabel: { flexShrink: 1, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  presetLabelOn: { color: c.bg.primary },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  chip: { paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  chipOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  chipLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  chipLabelOn: { color: c.bg.primary },
  targetChip: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 160 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing[1] },
  histChip: { paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.sm, backgroundColor: c.ui.in },
  histChipFirst: { backgroundColor: c.ui.in2 },
  histLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, fontVariant: ['tabular-nums'] },
  undo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  undoLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.secondary },

  footer: { flexDirection: 'row', gap: spacing[2] },
  saveBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[3], borderRadius: radius.md, backgroundColor: c.text.bright },
  saveLabel: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.bg.primary },
  disabled: { opacity: 0.4 },
  delBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: spacing[4], borderRadius: radius.md, borderWidth: 1, borderColor: c.accent.red + '66' },
  delBtnOn: { backgroundColor: c.accent.red, borderColor: c.accent.red },
  delLabel: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },
}));
