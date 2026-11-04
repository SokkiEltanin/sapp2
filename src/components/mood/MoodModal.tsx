import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { X, Check, BookOpen, SquarePen } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { todayISO } from '@/utils/date';
import { haptic } from '@/utils/haptics';
import { type MoodEntry, MOOD_COLORS, MOOD_LABELS, ENERGY_LABELS, roundLevel } from '@/types/mood';
import { useMoodStore } from '@/store/moodStore';
import { PRESET_TAGS, sortMoodTags } from '@/utils/moodTags';
import MoodPad from '@/components/design/MoodPad';
import AppBottomSheet from '@/components/design/AppBottomSheet';

// Port z sapp (MoodCheckInModal.tsx) + NOWA sekcja "Pamiętnik" w JEDNYM modalu (user,
// 2026-10-31: "humor... z taką siatką jak w sapp i opcjonalnym tekstem, zapisywanym tym
// razem w formie pamiętnika DZIEŃ DATA"). Zamiast dwóch osobnych modali (check-in +
// historia), jeden "Humor" surface z przełącznikiem widoku w headerze.
//
// Przebudowa na `AppBottomSheet` (2026-11-02, user: "animacje jak blur wylatuje...
// wyglądało 1do1 jak tam" — mockup ma KAŻDĄ interakcję jako bottom sheet z blur
// backdropem, nie pełnoekranowy `Modal` ze slide'm, którym to było dotąd).
// `AppBottomSheet` od Fazy 3.15 (2026-11-04) jest WŁASNYM `Modal`-em, nie
// `@gorhom/bottom-sheet` — zwykły `TextInput`/`ScrollView` z 'react-native',
// bez specjalnych `BottomSheet*` wariantów (ten sheet nie ma gestu
// przeciągania, więc nie ma już z czym konkurować o dotyk/fokus).
//
// Model danych: BEZ nowego pola na "dziennik dnia" — `MoodEntry.note` jest już
// per-wpisem notatką; widok "Pamiętnik" grupuje wpisy po `date` pod nagłówkiem
// "DZIEŃ · {data}" i renderuje notatki jak akapity dziennika. "Dopisać więcej o dniu"
// = zrobić kolejny check-in tego dnia z własną notatką — nie osobny rekord do pilnowania.
export default function MoodModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const entries = useMoodStore((st) => st.entries);
  const addEntry = useMoodStore((st) => st.addEntry);
  const updateEntry = useMoodStore((st) => st.updateEntry);

  const [view, setView] = useState<'checkin' | 'diary'>('checkin');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mood, setMood] = useState<number | undefined>();
  const [energy, setEnergy] = useState<number | undefined>();
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');

  const todayStr = todayISO();
  const todayCount = useMemo(() => entries.filter((e) => e.date === todayStr).length, [entries, todayStr]);
  const editingEntry = editingId ? entries.find((e) => e.id === editingId) ?? null : null;
  const ordinal = editingEntry ? null : todayCount + 1;

  const sortedPresetTags = useMemo(() => sortMoodTags(mood, energy, entries), [mood, energy, entries]);
  const allDisplayTags = [...tags.filter((t) => !PRESET_TAGS.includes(t)), ...sortedPresetTags];

  const resetForm = () => {
    setEditingId(null); setMood(undefined); setEnergy(undefined); setNote(''); setTags([]); setCustomTag('');
  };

  useEffect(() => {
    if (!visible) { resetForm(); setView('checkin'); }
  }, [visible]);

  const handleClose = () => { haptic.tap(); resetForm(); onClose(); };

  const openForEdit = (entry: MoodEntry) => {
    haptic.tap();
    setEditingId(entry.id);
    setMood(entry.mood); setEnergy(entry.energy); setNote(entry.note ?? ''); setTags(entry.tags);
    setView('checkin');
  };

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setCustomTag('');
  };
  const toggleTag = (tag: string) => { haptic.tap(); setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])); };

  const canSave = !!mood && !!energy;
  const handleSave = () => {
    if (!canSave) return;
    haptic.success();
    const now = new Date().toISOString();
    if (editingEntry) {
      updateEntry(editingEntry.id, { mood, energy, note: note.trim() || undefined, tags, updatedAt: now });
    } else {
      addEntry({ id: genId(), date: todayStr, mood: mood!, energy: energy!, note: note.trim() || undefined, tags, createdAt: now, updatedAt: now });
    }
    resetForm();
    handleClose();
  };

  // Kropki historii (DESIGN.md §Komponenty "MoodPad – ... kropki historii 7 dni")
  // — `MoodPad` już UMIAŁ to renderować (`history` prop, `histDot` styl), tylko
  // nikt tu go nie podawał. Jeden punkt na dzień (ostatni check-in tego dnia,
  // jeśli było kilka), ostatnie 7 dni z wpisem, posortowane rosnąco. Edytowany
  // wpis wyłączony (inaczej duplikowałby się z żywą kropką poniżej). Żywa,
  // przeciągana wartość dopisana jako OSTATNI element — `MoodPad` celowo
  // wyklucza ostatni element z przygaszonych kropek (`history.slice(0, -1)`),
  // bo on i tak jest już pokazany jako jasna, animowana kropka.
  const recentHistory = useMemo(() => {
    const byDate = new Map<string, MoodEntry>();
    for (const e of entries) {
      if (editingEntry && e.id === editingEntry.id) continue;
      const prev = byDate.get(e.date);
      if (!prev || e.createdAt > prev.createdAt) byDate.set(e.date, e);
    }
    return [...byDate.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7)
      .map((e) => ({ mood: e.mood, energy: e.energy }));
  }, [entries, editingEntry]);
  const padHistory = useMemo(
    () => [...recentHistory, { mood: mood ?? 3, energy: energy ?? 3 }] as { mood: number; energy: number }[],
    [recentHistory, mood, energy],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, MoodEntry[]>();
    for (const e of entries) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => [date, list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))] as const);
  }, [entries]);

  const chipColor = mood ? MOOD_COLORS[roundLevel(mood)] : undefined;

  const header = (
    <View style={s.header}>
      <View style={s.flex1}>
        <Text style={s.title}>
          {view === 'diary' ? 'Pamiętnik' : editingEntry ? 'Edytuj check-in' : ordinal === 1 ? 'Jak się czujesz?' : `Humor ${ordinal}. raz dziś`}
        </Text>
        {view === 'checkin' && (
          <Text style={s.subtitle}>
            {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
            {!editingEntry && todayCount > 0 ? ` · masz już ${todayCount} dziś` : ''}
          </Text>
        )}
      </View>
      <TouchableOpacity
        onPress={() => { haptic.tap(); setView((v) => (v === 'checkin' ? 'diary' : 'checkin')); }}
        style={s.iconBtn}
        hitSlop={8}
      >
        {view === 'checkin' ? <BookOpen size={17} color={colors.text.secondary} /> : <SquarePen size={17} color={colors.text.secondary} />}
      </TouchableOpacity>
      <TouchableOpacity onPress={handleClose} style={s.iconBtn} hitSlop={8}>
        <X size={18} color={colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );

  const footer = view === 'checkin' ? (
    <TouchableOpacity style={[s.saveBtn, !canSave && s.btnDisabled]} onPress={handleSave} disabled={!canSave} activeOpacity={0.7}>
      <Check size={16} color={colors.bg.primary} />
      <Text style={s.saveLabel}>{editingEntry ? 'Zaktualizuj' : 'Zapisz'}</Text>
    </TouchableOpacity>
  ) : undefined;

  return (
    <AppBottomSheet visible={visible} onClose={handleClose} header={header} footer={footer}>
      {view === 'checkin' ? (
        <View style={s.checkinBody}>
          <View style={s.section}>
            <Text style={s.sectionLabel}>Co czujesz?</Text>
            <View style={s.tagsRow}>
              <TextInput
                value={customTag}
                onChangeText={setCustomTag}
                placeholder="+ własny"
                placeholderTextColor={colors.text.muted}
                style={s.customTagInput}
                onSubmitEditing={addCustomTag}
                returnKeyType="done"
              />
              <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={s.tagsScroll}>
                {allDisplayTags.map((tag) => {
                  const selected = tags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[s.tagChip, selected && { backgroundColor: chipColor ?? colors.text.bright, borderColor: chipColor ?? colors.text.bright }]}
                      onPress={() => toggleTag(tag)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.tagChipLabel, selected && s.tagChipLabelActive]}>{tag}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Notatka dnia (opcjonalnie)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Co słychać? Trafi do pamiętnika pod dzisiejszą datą."
              placeholderTextColor={colors.text.muted}
              style={s.noteInput}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={s.padSection}>
            <Text style={s.sectionLabel}>Nastrój i energia</Text>
            <Text style={s.hint}>przeciągnij lub tapnij — w prawo lepszy nastrój, w górę więcej energii</Text>
            <MoodPad mood={mood} energy={energy} onChange={(m, e) => { setMood(m); setEnergy(e); }} big history={padHistory} />
          </View>
        </View>
      ) : (
        <View style={s.diaryBody}>
          {byDay.length === 0 ? (
            <Text style={s.empty}>Pamiętnik jest jeszcze pusty — zapisz pierwszy nastrój.</Text>
          ) : (
            byDay.map(([date, list]) => (
              <View key={date} style={s.daySection}>
                <Text style={s.dayHeader}>DZIEŃ · {formatDiaryDate(date)}</Text>
                {list.map((e) => (
                  <TouchableOpacity key={e.id} style={s.entryCard} onPress={() => openForEdit(e)} activeOpacity={0.7}>
                    <View style={s.entryTopRow}>
                      <View style={s.entryMoodRow}>
                        <View style={[s.entryDot, { backgroundColor: MOOD_COLORS[roundLevel(e.mood)] }]} />
                        <Text style={s.entryMood}>{MOOD_LABELS[roundLevel(e.mood)]} · {ENERGY_LABELS[roundLevel(e.energy)]}</Text>
                      </View>
                      <Text style={s.entryTime}>{new Date(e.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    {e.tags.length > 0 && (
                      <View style={s.entryTags}>
                        {e.tags.map((t) => <Text key={t} style={s.entryTag}>#{t}</Text>)}
                      </View>
                    )}
                    {e.note && <Text style={s.entryNote}>{e.note}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
        </View>
      )}
    </AppBottomSheet>
  );
}

function genId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function formatDiaryDate(dateYmd: string): string {
  const d = new Date(`${dateYmd}T12:00:00`);
  const s = d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const makeS = themedStyles((c) => StyleSheet.create({
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    paddingBottom: spacing[3], borderBottomWidth: 1, borderBottomColor: c.border.default,
  },
  title: { fontSize: 19, fontFamily: 'Inter_900Black', color: c.text.primary },
  subtitle: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },

  checkinBody: { paddingTop: spacing[3], gap: spacing[4] },
  diaryBody: { paddingTop: spacing[3] },
  section: { gap: spacing[2] },
  padSection: { gap: spacing[1] },
  sectionLabel: {
    fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  hint: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginBottom: spacing[2] },

  tagsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  customTagInput: {
    fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.primary,
    backgroundColor: c.bg.card, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: 6, minWidth: 70,
  },
  tagsScroll: { flexDirection: 'row', gap: spacing[2] },
  tagChip: {
    paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full,
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },
  tagChipLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  tagChipLabelActive: { color: c.bg.primary },

  noteInput: {
    fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.primary,
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[3], minHeight: 100,
  },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: c.text.bright, borderRadius: radius.md, paddingVertical: spacing[3],
  },
  btnDisabled: { opacity: 0.35 },
  saveLabel: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.bg.primary },

  empty: { fontSize: 12.5, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', paddingVertical: spacing[6] },
  daySection: { marginBottom: spacing[5] },
  dayHeader: {
    fontSize: 11.5, fontFamily: 'Inter_900Black', color: c.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing[2],
  },
  entryCard: {
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[3], marginBottom: spacing[2], gap: spacing[1],
  },
  entryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryMoodRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryDot: { width: 8, height: 8, borderRadius: 4 },
  entryMood: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  entryTime: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted },
  entryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  entryTag: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  entryNote: { fontSize: 12.5, fontFamily: 'Inter_400Regular', color: c.text.secondary, marginTop: 2, lineHeight: 18 },
}));
