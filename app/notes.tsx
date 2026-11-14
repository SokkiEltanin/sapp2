import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Search, Pin, Type, ListChecks, PenTool } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { useNotesStore } from '@/store/notesStore';
import type { NoteKind } from '@/types/notes';
import { noteTitle, sortNotes, searchNotes } from '@/utils/notes';
import NotePreview from '@/components/notes/NotePreview';
import { haptic } from '@/utils/haptics';
import { openNewNote, openNote } from '@/services/notesNav';

// Notatki — lista (2026-11-14). Nowa: Tekst / Lista / Rysunek (rysik S-Pen).
// Przypięta (pinezka) = kafel na Dashboardzie. Lista odhaczana z podglądu.
const KINDS: { k: NoteKind; label: string; Icon: typeof Type }[] = [
  { k: 'text', label: 'Tekst', Icon: Type },
  { k: 'list', label: 'Lista', Icon: ListChecks },
  { k: 'drawing', label: 'Rysunek', Icon: PenTool },
];

export default function NotesScreen() {
  const s = makeS();
  const notes = useNotesStore((st) => st.notes);
  const toggleItem = useNotesStore((st) => st.toggleItem);
  const [q, setQ] = useState('');
  const shown = useMemo(() => searchNotes(sortNotes(notes), q), [notes, q]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headBtn} hitSlop={8}><ChevronLeft size={22} color={colors.text.primary} /></TouchableOpacity>
        <Text style={s.title}>Notatki</Text>
        <View style={s.headBtn} />
      </View>

      <View style={s.newRow}>
        {KINDS.map(({ k, label, Icon }) => (
          <TouchableOpacity key={k} style={s.newBtn} onPress={() => { haptic.tap(); openNewNote(k); }} activeOpacity={0.8}>
            <Icon size={16} color={colors.text.primary} />
            <Text style={s.newLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {notes.length > 3 && (
        <View style={s.searchRow}>
          <Search size={14} color={colors.text.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Szukaj w notatkach…" placeholderTextColor={colors.text.muted} style={s.searchInput} />
        </View>
      )}

      <FlatList
        data={shown}
        keyExtractor={(n) => n.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>{notes.length ? 'Nic nie znaleziono.' : 'Brak notatek — wybierz rodzaj wyżej. Pinezka w notatce przypina ją na Dashboard.'}</Text>}
        renderItem={({ item: n }) => (
          <TouchableOpacity style={s.card} onPress={() => { haptic.tap(); openNote(n.id); }} activeOpacity={0.8}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle} numberOfLines={1}>{noteTitle(n)}</Text>
              {n.pinned && <Pin size={13} color={colors.accent.orange} />}
            </View>
            <NotePreview note={n} maxLines={4} compact onToggle={(itemId) => { haptic.tap(); toggleItem(n.id, itemId); }} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  headBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  newRow: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[4], marginBottom: spacing[2] },
  newBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing[3], borderRadius: radius.md, backgroundColor: c.bg.card },
  newLabel: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginHorizontal: spacing[4], marginBottom: spacing[2], paddingHorizontal: spacing[3], borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.text.primary, paddingVertical: spacing[2] },
  list: { paddingHorizontal: spacing[4], paddingBottom: 40, gap: spacing[2] },
  empty: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, lineHeight: 18, paddingVertical: spacing[4] },
  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, padding: spacing[3], gap: spacing[2] },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
}));
