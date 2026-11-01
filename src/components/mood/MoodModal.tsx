import { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { X, Check, BookOpen, SquarePen } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { todayISO } from '@/utils/date';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { type MoodEntry, type MoodLevel, MOOD_COLORS, MOOD_LABELS, ENERGY_LABELS } from '@/types/mood';
import { useMoodStore } from '@/store/moodStore';
import { PRESET_TAGS, sortMoodTags } from '@/utils/moodTags';
import MoodPad from '@/components/design/MoodPad';

// Port z sapp (MoodCheckInModal.tsx) + NOWA sekcja "Pamiętnik" w JEDNYM modalu (user,
// 2026-10-31: "humor... z taką siatką jak w sapp i opcjonalnym tekstem, zapisywanym tym
// razem w formie pamiętnika DZIEŃ DATA"). Zamiast dwóch osobnych modali (check-in +
// historia), jeden "Humor" surface z przełącznikiem widoku w headerze — tak samo jak
// wszystkie inne popupy w sapp2 (pełnoekranowy Modal, nie bottom-sheet jak w sapp).
//
// `GestureHandlerRootView` + `ScrollView` z 'react-native-gesture-handler' (NIE z
// 'react-native') — KRYTYCZNE, nie kosmetyka: RN's `Modal` portuje swoją treść do
// OSOBNEJ natywnej hierarchii, poza drzewiem które jedyny `GestureHandlerRootView` w
// app/_layout.tsx opakowuje — bez własnego roota tutaj `Gesture.Pan()` w
// `MoodEnergyGrid` nigdy nie dostaje poprawnie routowanych dotknięć (sapp, dwa
// potwierdzone na urządzeniu bugi, patrz komentarze w MoodEnergyGrid.tsx/tu).
//
// Model danych: BEZ nowego pola na "dziennik dnia" — `MoodEntry.note` jest już
// per-wpisem notatką; widok "Pamiętnik" grupuje wpisy po `date` pod nagłówkiem
// "DZIEŃ · {data}" i renderuje notatki jak akapity dziennika. "Dopisać więcej o dniu"
// = zrobić kolejny check-in tego dnia z własną notatką — nie osobny rekord do pilnowania.
export default function MoodModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const kb = useKeyboardHeight();
  const entries = useMoodStore((st) => st.entries);
  const addEntry = useMoodStore((st) => st.addEntry);
  const updateEntry = useMoodStore((st) => st.updateEntry);

  const [view, setView] = useState<'checkin' | 'diary'>('checkin');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodLevel | undefined>();
  const [energy, setEnergy] = useState<MoodLevel | undefined>();
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

  const handleClose = () => { resetForm(); onClose(); };

  const openForEdit = (entry: MoodEntry) => {
    setEditingId(entry.id);
    setMood(entry.mood); setEnergy(entry.energy); setNote(entry.note ?? ''); setTags(entry.tags);
    setView('checkin');
  };

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setCustomTag('');
  };
  const toggleTag = (tag: string) => setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const canSave = !!mood && !!energy;
  const handleSave = () => {
    if (!canSave) return;
    const now = new Date().toISOString();
    if (editingEntry) {
      updateEntry(editingEntry.id, { mood, energy, note: note.trim() || undefined, tags, updatedAt: now });
    } else {
      addEntry({ id: genId(), date: todayStr, mood: mood!, energy: energy!, note: note.trim() || undefined, tags, createdAt: now, updatedAt: now });
    }
    resetForm();
    handleClose();
  };

  const byDay = useMemo(() => {
    const map = new Map<string, MoodEntry[]>();
    for (const e of entries) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => [date, list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))] as const);
  }, [entries]);

  const chipColor = mood ? MOOD_COLORS[mood] : undefined;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={handleClose}>
      <GestureHandlerRootView style={s.flex1}>
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          {/* `paddingBottom: kb` zamiast `KeyboardAvoidingView` — patrz identyczny
              komentarz w AddExpenseModal.tsx (ten sam problem: `Modal` na Androidzie
              portuje treść poza zasięg `windowSoftInputMode`). */}
          <View style={[s.flex1, { paddingBottom: kb }]}>
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
                onPress={() => setView((v) => (v === 'checkin' ? 'diary' : 'checkin'))}
                style={s.iconBtn}
                hitSlop={8}
              >
                {view === 'checkin' ? <BookOpen size={17} color={colors.text.secondary} /> : <SquarePen size={17} color={colors.text.secondary} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose} style={s.iconBtn} hitSlop={8}>
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {view === 'checkin' ? (
              <>
                {/* Kolejność sekcji ODWRÓCONA (2026-11-01, user: "mam być wygodnie
                    wpisywać... jak to jest na górze ekranu wszystko" — siatka,
                    jedyny element wymagający przeciągania kciukiem, siedziała
                    NAJWYŻEJ, najdalej od naturalnej pozycji kciuka przy trzymaniu
                    telefonu jedną ręką; tagi/notatka to pojedyncze taty/pisanie,
                    mniej wymagające precyzji). Teraz: tagi → notatka → siatka, tuż
                    nad przyciskiem "Zapisz" — ten sam "bliżej kciuka" priorytet co
                    FAB wklejania paragonu w AddExpenseModal. */}
                <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
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
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tagsScroll}>
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
                    <MoodPad mood={mood} energy={energy} onChange={(m, e) => { setMood(m); setEnergy(e); }} big />
                  </View>
                </ScrollView>

                <View style={s.footer}>
                  <TouchableOpacity style={[s.saveBtn, !canSave && s.btnDisabled]} onPress={handleSave} disabled={!canSave} activeOpacity={0.7}>
                    <Check size={16} color={colors.bg.primary} />
                    <Text style={s.saveLabel}>{editingEntry ? 'Zaktualizuj' : 'Zapisz'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <ScrollView contentContainerStyle={s.scroll}>
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
                              <View style={[s.entryDot, { backgroundColor: MOOD_COLORS[e.mood] }]} />
                              <Text style={s.entryMood}>{MOOD_LABELS[e.mood]} · {ENERGY_LABELS[e.energy]}</Text>
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
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
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
  safe: { flex: 1, backgroundColor: c.bg.primary },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.default,
  },
  title: { fontSize: 19, fontFamily: 'Inter_900Black', color: c.text.primary },
  subtitle: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 2 },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },

  scroll: { paddingHorizontal: spacing[4], paddingVertical: spacing[4], gap: spacing[4] },
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

  footer: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderTopWidth: 1, borderTopColor: c.border.default,
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
