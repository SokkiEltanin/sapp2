import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Switch, Platform, ActivityIndicator } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { CalendarDays, Clock, AlignLeft, Trash2, Palette } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useEventEditor, closeEventEditor } from '@/services/eventEditor';
import { useCalendarStore } from '@/store/calendarStore';
import { googleCalendarService } from '@/services/googleCalendarService';
import { refreshGoogleCalendarNow } from '@/hooks/useGoogleCalendarSync';
import { GCAL_COLORS, eventRangeOk, type EventInput } from '@/utils/googleCalendarMap';
import { ymd } from '@/utils/date';
import { haptic } from '@/utils/haptics';
import type { CalendarEvent } from '@/types/calendar';

// Formularz wydarzenia w stylu Samsunga (2026-11-15, user: "edycja eventów kalendarza
// Google... formularz super jak na samsungu"): tytuł, "Cały dzień", początek i koniec
// (data + godzina z systemowych okienek), wiele dni, kolor, opis; Zapisz / Usuń.
// Wydarzenie Google → zapis w Kalendarzu Google (googleCalendarService.saveEvent), od
// razu też lokalnie (bez czekania na pobranie). Lokalne → calendarStore (synchronizacja).
// Komputer: wydarzeń Google nie da się tam zapisać (brak logowania z Androida).
const COLORS = Object.values(GCAL_COLORS);
const DAYS = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const dateLabel = (d: string) => { const x = new Date(`${d}T00:00:00`); return `${DAYS[x.getDay()]} ${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`; };
const pad = (n: number) => String(n).padStart(2, '0');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, TIME_RE = /^\d{2}:\d{2}$/;

function nextHour(): [string, string] {
  const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1);
  const e = new Date(d.getTime() + 3600000);
  return [`${pad(d.getHours())}:00`, `${pad(e.getHours())}:00`];
}
const addMinutes = (t: string, m: number) => { const [h, mm] = t.split(':').map(Number); const x = (h * 60 + mm + m + 1440) % 1440; return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`; };

export default function EventEditSheet() {
  const s = makeS();
  const req = useEventEditor((st) => st.req);
  const editing = req && 'event' in req ? req.event : null;
  const isGcal = !!editing?.id.startsWith('gcal-');
  const [f, setF] = useState<EventInput>({ title: '', date: ymd(new Date()), allDay: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!req) return;
    setErr(null); setConfirmDel(false); setBusy(false);
    if ('event' in req) {
      const e = req.event;
      setF({ title: e.title, description: e.description ?? '', date: e.date.slice(0, 10), endDate: e.endDate, startTime: e.startTime, endTime: e.endTime, allDay: e.allDay || !e.startTime, color: e.color });
    } else {
      const [st, en] = nextHour();
      setF({ title: '', description: '', date: req.newOn, startTime: st, endTime: en, allDay: false, color: GCAL_COLORS['7'] });
    }
  }, [req]);

  const set = (p: Partial<EventInput>) => setF((x) => ({ ...x, ...p }));
  const webGcal = Platform.OS === 'web' && isGcal;
  const ok = f.title.trim().length > 0 && eventRangeOk(f) && DATE_RE.test(f.date) && (f.allDay || (TIME_RE.test(f.startTime ?? '') && TIME_RE.test(f.endTime ?? '')));

  const pickDate = (which: 'date' | 'endDate') => {
    const cur = (which === 'date' ? f.date : f.endDate || f.date);
    DateTimePickerAndroid.open({
      value: new Date(`${cur}T12:00:00`), mode: 'date',
      onChange: (ev, d) => {
        if (ev.type !== 'set' || !d) return;
        const v = ymd(d);
        if (which === 'date') {
          // Przesunięcie początku przesuwa koniec o tyle samo (jak w Samsungu).
          const span = f.endDate ? (new Date(`${f.endDate}T00:00:00`).getTime() - new Date(`${f.date}T00:00:00`).getTime()) / 86400000 : 0;
          const end = span > 0 ? ymd(new Date(new Date(`${v}T00:00:00`).getTime() + span * 86400000)) : undefined;
          set({ date: v, endDate: end });
        } else set({ endDate: v > f.date ? v : undefined });
      },
    });
  };
  const pickTime = (which: 'startTime' | 'endTime') => {
    const [h, m] = (f[which] ?? '09:00').split(':').map(Number);
    const base = new Date(); base.setHours(h, m, 0, 0);
    DateTimePickerAndroid.open({
      value: base, mode: 'time', is24Hour: true,
      onChange: (ev, d) => {
        if (ev.type !== 'set' || !d) return;
        const v = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        if (which === 'startTime' && f.startTime && f.endTime) {
          // Zachowaj długość wydarzenia przy zmianie początku.
          const [sh, sm] = f.startTime.split(':').map(Number), [eh, em] = f.endTime.split(':').map(Number);
          set({ startTime: v, endTime: addMinutes(v, (eh * 60 + em) - (sh * 60 + sm)) });
        } else set({ [which]: v });
      },
    });
  };

  const save = async () => {
    if (!ok || busy) return;
    haptic.tap();
    setBusy(true); setErr(null);
    const st = useCalendarStore.getState();
    const local: Partial<CalendarEvent> = {
      title: f.title.trim(), description: f.description?.trim() || undefined, date: f.date,
      endDate: f.endDate && f.endDate > f.date ? f.endDate : undefined,
      startTime: f.allDay ? undefined : f.startTime, endTime: f.allDay ? undefined : f.endTime,
      allDay: f.allDay, color: f.color,
    };
    try {
      if (editing && !isGcal) {
        st.updateEvent(editing.id, local);
      } else if (editing) {
        const before = editing;
        st.updateEvent(editing.id, local);
        const res = await googleCalendarService.saveEvent(f, editing.id);
        if (!res) { st.updateEvent(editing.id, before); throw new Error('Nie udało się zapisać w Kalendarzu Google (sieć albo logowanie). Zmiana cofnięta.'); }
      } else if (Platform.OS !== 'web') {
        const gid = await googleCalendarService.saveEvent(f);
        if (!gid) throw new Error('Nie udało się dodać do Kalendarza Google (sieć albo logowanie).');
        st.setGcalEvents([...useCalendarStore.getState().gcalEvents, { id: `gcal-${gid}`, priority: 'normal', createdAt: new Date().toISOString(), ...local } as CalendarEvent]);
      } else {
        st.addEvent({ id: `local_${Date.now().toString(36)}`, priority: 'normal', createdAt: new Date().toISOString(), ...local } as CalendarEvent);
      }
      haptic.success();
      if (isGcal || (!editing && Platform.OS !== 'web')) refreshGoogleCalendarNow();
      closeEventEditor();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing || busy) return;
    if (!confirmDel) { haptic.warn(); setConfirmDel(true); return; }
    setBusy(true); setErr(null);
    const st = useCalendarStore.getState();
    if (isGcal) {
      const okDel = await googleCalendarService.deleteEvent(editing.id);
      if (!okDel) { setBusy(false); setErr('Nie udało się usunąć z Kalendarza Google.'); return; }
    }
    st.deleteEvent(editing.id);
    haptic.success();
    setBusy(false);
    closeEventEditor();
  };

  const dateField = (which: 'date' | 'endDate') => {
    const v = which === 'date' ? f.date : f.endDate || f.date;
    if (Platform.OS === 'web') {
      return <TextInput value={v} onChangeText={(t) => (which === 'date' ? set({ date: t }) : set({ endDate: t > f.date ? t : undefined }))} style={[s.chip, s.chipInput]} placeholder="RRRR-MM-DD" placeholderTextColor={colors.text.muted} />;
    }
    return (
      <TouchableOpacity style={s.chip} onPress={() => { haptic.tap(); pickDate(which); }}>
        <Text style={s.chipText} numberOfLines={1}>{dateLabel(v)}</Text>
      </TouchableOpacity>
    );
  };
  const timeField = (which: 'startTime' | 'endTime') => {
    if (Platform.OS === 'web') {
      return <TextInput value={f[which] ?? ''} onChangeText={(t) => set({ [which]: t })} style={[s.chip, s.chipInput, s.timeChip]} placeholder="GG:MM" placeholderTextColor={colors.text.muted} />;
    }
    return (
      <TouchableOpacity style={[s.chip, s.timeChip]} onPress={() => { haptic.tap(); pickTime(which); }}>
        <Text style={s.chipTextBig}>{f[which] ?? '--:--'}</Text>
      </TouchableOpacity>
    );
  };

  const footer = (
    <View style={s.footer}>
      {editing && (
        <TouchableOpacity style={[s.delBtn, confirmDel && s.delOn]} onPress={remove} disabled={busy || webGcal} accessibilityLabel="Usuń wydarzenie">
          <Trash2 size={16} color={confirmDel ? colors.bg.primary : colors.text.secondary} />
          {confirmDel && <Text style={s.delLabel}>Na pewno?</Text>}
        </TouchableOpacity>
      )}
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={s.cancel} onPress={() => { haptic.tap(); closeEventEditor(); }}><Text style={s.cancelLabel}>Anuluj</Text></TouchableOpacity>
      <TouchableOpacity style={[s.saveBtn, (!ok || webGcal) && { opacity: 0.4 }]} onPress={save} disabled={!ok || busy || webGcal}>
        {busy ? <ActivityIndicator size="small" color={colors.bg.primary} /> : <Text style={s.saveLabel}>Zapisz</Text>}
      </TouchableOpacity>
    </View>
  );

  return (
    <AppBottomSheet visible={!!req} onClose={closeEventEditor} maxHeightRatio={0.92} footer={footer}
      header={<Text style={s.sheetTitle}>{editing ? 'Wydarzenie' : 'Nowe wydarzenie'}{isGcal || (!editing && Platform.OS !== 'web') ? ' · Google' : ''}</Text>}>
      <TextInput value={f.title} onChangeText={(t) => set({ title: t })} placeholder="Tytuł" placeholderTextColor={colors.text.muted}
        style={[s.title, { borderLeftColor: f.color ?? colors.text.secondary }]} autoFocus={!editing} />

      <View style={s.card}>
        <View style={s.rowLine}>
          <Clock size={16} color={colors.text.secondary} />
          <Text style={s.rowLabel}>Cały dzień</Text>
          <Switch value={f.allDay} onValueChange={(v) => { haptic.tap(); set(v ? { allDay: true } : { allDay: false, startTime: f.startTime ?? nextHour()[0], endTime: f.endTime ?? nextHour()[1] }); }}
            trackColor={{ true: colors.text.bright, false: colors.ui.in2 }} thumbColor={f.allDay ? colors.bg.primary : colors.text.secondary} />
        </View>
        <View style={s.sep} />
        <View style={s.rangeRow}>
          <Text style={s.rangeTag}>Początek</Text>
          {dateField('date')}
          {!f.allDay && timeField('startTime')}
        </View>
        <View style={s.rangeRow}>
          <Text style={s.rangeTag}>Koniec</Text>
          {dateField('endDate')}
          {!f.allDay && timeField('endTime')}
        </View>
        {!eventRangeOk(f) && <Text style={s.err}>Koniec musi być po początku.</Text>}
      </View>

      <View style={s.card}>
        <View style={s.rowLine}>
          <Palette size={16} color={colors.text.secondary} />
          <Text style={s.rowLabel}>Kolor</Text>
        </View>
        <View style={s.colors}>
          {COLORS.map((c) => (
            <TouchableOpacity key={c} onPress={() => { haptic.tap(); set({ color: c }); }} style={[s.color, { backgroundColor: c }, f.color?.toLowerCase() === c.toLowerCase() && s.colorOn]} accessibilityLabel={`Kolor ${c}`} />
          ))}
        </View>
      </View>

      <View style={s.card}>
        <View style={s.rowLine}>
          <AlignLeft size={16} color={colors.text.secondary} />
          <TextInput value={f.description ?? ''} onChangeText={(t) => set({ description: t })} placeholder="Opis / notatka" placeholderTextColor={colors.text.muted}
            style={s.desc} multiline />
        </View>
      </View>

      {webGcal && <Text style={s.info}><CalendarDays size={11} color={colors.text.muted} /> Wydarzenia Google zapisujesz na telefonie — tu tylko podgląd.</Text>}
      {err && <Text style={s.err}>{err}</Text>}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  sheetTitle: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary, paddingBottom: spacing[2] },
  title: { fontSize: 20, fontFamily: 'Inter_800ExtraBold', color: c.text.primary, borderLeftWidth: 4, paddingLeft: spacing[3], paddingVertical: spacing[2], marginBottom: spacing[3] },
  card: { backgroundColor: c.bg.elevated, borderRadius: radius.lg, padding: spacing[3], marginBottom: spacing[3], gap: spacing[2] },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary },
  sep: { height: 1, backgroundColor: c.ui.line },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  rangeTag: { width: 56, fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  chip: { flex: 1, flexBasis: 0, minWidth: 0, height: 40, borderRadius: radius.md, backgroundColor: c.bg.card, justifyContent: 'center', paddingHorizontal: spacing[3] },
  chipInput: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  timeChip: { flex: 0, flexBasis: 70, width: 70, paddingHorizontal: 0, alignItems: 'center', textAlign: 'center' } as any,
  chipText: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  chipTextBig: { fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.primary },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  color: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorOn: { borderColor: c.text.bright, transform: [{ scale: 1.12 }] },
  desc: { flex: 1, minHeight: 60, fontSize: 14, fontFamily: 'Inter_500Medium', color: c.text.primary, textAlignVertical: 'top' },
  info: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginBottom: spacing[2] },
  err: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.accent.red },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  delBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: spacing[3], borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  delOn: { backgroundColor: c.accent.red, borderColor: c.accent.red },
  delLabel: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.bg.primary },
  cancel: { height: 42, paddingHorizontal: spacing[3], justifyContent: 'center' },
  cancelLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.muted },
  saveBtn: { height: 42, minWidth: 96, paddingHorizontal: spacing[4], borderRadius: radius.md, backgroundColor: c.text.bright, alignItems: 'center', justifyContent: 'center' },
  saveLabel: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.bg.primary },
}));
